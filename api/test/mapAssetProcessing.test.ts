// SPDX-License-Identifier: Apache-2.0
import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {getMapAssetsDB} from '../src/couchdb';
import {cleanupStaging} from '../src/couchdb/mapAssets/staging';
import {
  MAP_ASSET_ORIGINALS_MISSING_REASON,
  MAP_ASSET_PROCESSING_EXHAUSTED_REASON,
  MAP_ASSET_PROCESSING_MAX_ATTEMPTS,
  createMapAsset,
  findUnclaimedSpatialJob,
  getMapAsset,
  mapAssetIsClaimable,
  processMapAsset,
  replaceMapAssetFiles,
  storeOriginalsFromStaging,
  summarizeSpatialBacklog,
  sweepPendingOriginalUploads,
} from '../src/couchdb/mapAssets/store';
import {resetDatabases} from './mocks';

const normalizeMapUpload = vi.hoisted(() => vi.fn());

vi.mock('../src/couchdb/mapAssets/normalize', async () => {
  const actual = await vi.importActual<
    typeof import('../src/couchdb/mapAssets/normalize')
  >('../src/couchdb/mapAssets/normalize');
  return {...actual, normalizeMapUpload};
});

const T0 = 1_700_000_000_000;
const CLAIM_TIMEOUT_MS = 1_000;

function normalizedFixture() {
  return {
    kind: 'vector-tiles' as const,
    bytes: Buffer.from('pmtiles'),
    mediaType: 'application/vnd.pmtiles',
    minZoom: 0,
    maxZoom: 1,
    tileSize: 256,
    extent4326: [0, 0, 1, 1] as [number, number, number, number],
  };
}

async function createPendingAsset() {
  return createMapAsset({
    name: 'Layer',
    description: '',
    createdBy: 'user-1',
    files: [{filename: 'layer.geojson', bytes: Buffer.from('{}')}],
    primaryFilename: 'layer.geojson',
  });
}

/** Stage via create, then put originals in object storage the way the API does. */
async function createStoredAsset() {
  const asset = await createPendingAsset();
  await storeOriginalsFromStaging(asset._id);
  return getMapAsset(asset._id);
}

async function clearMapAssetDocs() {
  const db = getMapAssetsDB();
  const all = await db.allDocs();
  for (const row of all.rows) {
    if (row.id.startsWith('_design')) {
      continue;
    }
    await db.remove(row.id, row.value.rev);
  }
}

describe('map asset processing claim', () => {
  it('treats pending and stale processing as claimable, and a fresh claim as held', () => {
    expect(mapAssetIsClaimable({status: 'pending'}, T0, CLAIM_TIMEOUT_MS)).toBe(
      true
    );
    expect(
      mapAssetIsClaimable({status: 'processing'}, T0, CLAIM_TIMEOUT_MS)
    ).toBe(true);
    expect(
      mapAssetIsClaimable(
        {status: 'processing', processingStartedAt: T0 - CLAIM_TIMEOUT_MS},
        T0,
        CLAIM_TIMEOUT_MS
      )
    ).toBe(true);
    expect(
      mapAssetIsClaimable(
        {
          status: 'processing',
          processingStartedAt: T0 - CLAIM_TIMEOUT_MS + 1,
        },
        T0,
        CLAIM_TIMEOUT_MS
      )
    ).toBe(false);
    expect(
      mapAssetIsClaimable(
        {status: 'ready', processingStartedAt: T0 - CLAIM_TIMEOUT_MS},
        T0,
        CLAIM_TIMEOUT_MS
      )
    ).toBe(false);
    expect(mapAssetIsClaimable({status: 'failed'}, T0, CLAIM_TIMEOUT_MS)).toBe(
      false
    );
  });
});

describe('map asset original upload', () => {
  beforeAll(async () => {
    await resetDatabases();
  });

  beforeEach(async () => {
    await clearMapAssetDocs();
    normalizeMapUpload.mockReset();
    normalizeMapUpload.mockResolvedValue(normalizedFixture());
  });

  it('stores originals from staging and does not run GDAL', async () => {
    const asset = await createPendingAsset();
    const stored = await sweepPendingOriginalUploads({
      now: () => T0,
      originalUploadGraceMs: CLAIM_TIMEOUT_MS,
    });
    expect(stored).toEqual([asset._id]);
    const finished = await getMapAsset(asset._id);
    expect(finished.status).toBe('pending');
    expect(finished.processingStage).toBe('queued');
    expect(finished.processingAttempts).toBeUndefined();
    expect(finished.storedAttachments?.original?.provider).toBe('s3');
    expect(finished.storedAttachments?.original?.resourceUri).toContain(
      asset._id
    );
    expect(finished.storedAttachments?.normalized).toBeUndefined();
    expect(normalizeMapUpload).not.toHaveBeenCalled();
    expect(await findUnclaimedSpatialJob({now: () => T0})).toBe(asset._id);
  });

  it('does not claim or normalize a job that has no originals', async () => {
    const asset = await createPendingAsset();
    await processMapAsset(asset._id, {
      now: () => T0,
      claimTimeoutMs: CLAIM_TIMEOUT_MS,
    });
    const current = await getMapAsset(asset._id);
    expect(current.status).toBe('pending');
    expect(current.processingStage).toBe('uploading');
    expect(current.processingAttempts).toBeUndefined();
    expect(current.processingStartedAt).toBeUndefined();
    expect(normalizeMapUpload).not.toHaveBeenCalled();
    expect(
      await findUnclaimedSpatialJob({
        now: () => T0,
        claimTimeoutMs: CLAIM_TIMEOUT_MS,
      })
    ).toBeUndefined();
  });

  it('leaves a fresh claim alone and does not run GDAL from the sweep', async () => {
    const asset = await createStoredAsset();
    await getMapAssetsDB().put({
      ...asset,
      status: 'processing',
      processingStartedAt: T0,
      processingAttempts: 1,
    });
    const touched = await sweepPendingOriginalUploads({
      now: () => T0,
      claimTimeoutMs: CLAIM_TIMEOUT_MS,
    });
    expect(touched).toEqual([]);
    const held = await getMapAsset(asset._id);
    expect(held.status).toBe('processing');
    expect(held.processingAttempts).toBe(1);
    expect(held.processingStartedAt).toBe(T0);
    expect(normalizeMapUpload).not.toHaveBeenCalled();
    expect(
      await findUnclaimedSpatialJob({
        now: () => T0,
        claimTimeoutMs: CLAIM_TIMEOUT_MS,
      })
    ).toBeUndefined();
  });

  it('does not replace a layer that is still pending', async () => {
    const asset = await createPendingAsset();
    await expect(
      replaceMapAssetFiles({
        assetId: asset._id,
        files: [{filename: 'layer.geojson', bytes: Buffer.from('{}')}],
        primaryFilename: 'layer.geojson',
      })
    ).rejects.toThrow(/still being prepared/);
  });

  it('fails a pending asset whose files are gone after the grace period', async () => {
    const asset = await createPendingAsset();
    await cleanupStaging(asset._id);
    const current = await getMapAsset(asset._id);
    await getMapAssetsDB().put({
      ...current,
      updatedAt: T0 - CLAIM_TIMEOUT_MS,
    });
    const touched = await sweepPendingOriginalUploads({
      now: () => T0,
      originalUploadGraceMs: CLAIM_TIMEOUT_MS,
    });
    expect(touched).toEqual([asset._id]);
    const failed = await getMapAsset(asset._id);
    expect(failed.status).toBe('failed');
    expect(failed.failureReason).toBe(MAP_ASSET_ORIGINALS_MISSING_REASON);
    expect(normalizeMapUpload).not.toHaveBeenCalled();
  });
});

describe('map asset worker processing', () => {
  beforeAll(async () => {
    await resetDatabases();
  });

  beforeEach(async () => {
    await clearMapAssetDocs();
    normalizeMapUpload.mockReset();
    normalizeMapUpload.mockResolvedValue(normalizedFixture());
  });

  it('downloads originals, normalizes, and commits', async () => {
    const asset = await createStoredAsset();
    await processMapAsset(asset._id, {
      now: () => T0,
      claimTimeoutMs: CLAIM_TIMEOUT_MS,
      claimHeartbeatMs: 0,
    });
    const finished = await getMapAsset(asset._id);
    expect(finished.status).toBe('ready');
    expect(finished.processingAttempts).toBe(1);
    expect(finished.processingStartedAt).toBeUndefined();
    expect(finished.processingStage).toBeUndefined();
    expect(finished.storedAttachments?.original?.provider).toBe('s3');
    expect(finished.storedAttachments?.normalized?.provider).toBe('s3');
    expect(normalizeMapUpload).toHaveBeenCalledOnce();
  });

  it('marks the asset failed after the attempt cap without running GDAL again', async () => {
    const asset = await createStoredAsset();
    await getMapAssetsDB().put({
      ...asset,
      status: 'processing',
      processingStartedAt: T0 - CLAIM_TIMEOUT_MS,
      processingAttempts: MAP_ASSET_PROCESSING_MAX_ATTEMPTS,
    });

    await processMapAsset(asset._id, {
      now: () => T0,
      claimTimeoutMs: CLAIM_TIMEOUT_MS,
      claimHeartbeatMs: 0,
    });

    const failed = await getMapAsset(asset._id);
    expect(failed.status).toBe('failed');
    expect(failed.failureReason).toBe(MAP_ASSET_PROCESSING_EXHAUSTED_REASON);
    expect(failed.processingStartedAt).toBeUndefined();
    expect(normalizeMapUpload).not.toHaveBeenCalled();
  });

  it('fails a GDAL error immediately and does not offer the job again', async () => {
    normalizeMapUpload.mockRejectedValue(new Error('no crs'));
    const asset = await createStoredAsset();
    await processMapAsset(asset._id, {
      now: () => T0,
      claimTimeoutMs: CLAIM_TIMEOUT_MS,
      claimHeartbeatMs: 0,
    });

    const failed = await getMapAsset(asset._id);
    expect(failed.status).toBe('failed');
    expect(failed.failureReason).toBe('no crs');
    expect(failed.processingAttempts).toBe(1);
    expect(
      await findUnclaimedSpatialJob({
        now: () => T0 + CLAIM_TIMEOUT_MS,
        claimTimeoutMs: CLAIM_TIMEOUT_MS,
      })
    ).toBeUndefined();
  });

  it('does not let a second claim run GDAL while the first claim is fresh', async () => {
    const asset = await createStoredAsset();
    let release: () => void = () => undefined;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    normalizeMapUpload.mockImplementation(async () => {
      await gate;
      return normalizedFixture();
    });

    const first = processMapAsset(asset._id, {
      now: () => T0,
      claimTimeoutMs: CLAIM_TIMEOUT_MS,
      claimHeartbeatMs: 0,
    });
    try {
      const started = Date.now();
      while (Date.now() - started < 2000) {
        const current = await getMapAsset(asset._id);
        if (current.processingAttempts === 1) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      const claimed = await getMapAsset(asset._id);
      expect(claimed.processingAttempts).toBe(1);
      expect(claimed.status).toBe('processing');

      await processMapAsset(asset._id, {
        now: () => T0,
        claimTimeoutMs: CLAIM_TIMEOUT_MS,
        claimHeartbeatMs: 0,
      });
      expect(normalizeMapUpload).toHaveBeenCalledOnce();
    } finally {
      release();
      await first;
    }
    expect((await getMapAsset(asset._id)).status).toBe('ready');
  });

  it('leaves a ready asset in place when this run loses the claim', async () => {
    const asset = await createStoredAsset();
    normalizeMapUpload.mockImplementation(async () => {
      const latest = await getMapAsset(asset._id);
      await getMapAssetsDB().put({
        ...latest,
        status: 'ready',
        kind: 'vector-tiles',
        contentHash: 'kept',
        byteSize: 4,
        extent4326: [0, 0, 1, 1],
        updatedAt: T0,
      });
      throw new Error('late failure');
    });

    await processMapAsset(asset._id, {
      now: () => T0,
      claimTimeoutMs: CLAIM_TIMEOUT_MS,
      claimHeartbeatMs: 0,
    });

    const finished = await getMapAsset(asset._id);
    expect(finished.status).toBe('ready');
    expect(finished.contentHash).toBe('kept');
    expect(finished.failureReason).toBeUndefined();
  });

  it('clears the claim when the uploaded file is replaced', async () => {
    const asset = await createStoredAsset();
    const current = await getMapAsset(asset._id);
    await getMapAssetsDB().put({
      ...current,
      status: 'failed',
      failureReason: 'no crs',
      processingAttempts: MAP_ASSET_PROCESSING_MAX_ATTEMPTS,
      processingStartedAt: T0,
    });

    const replaced = await replaceMapAssetFiles({
      assetId: asset._id,
      files: [
        {
          filename: 'layer.geojson',
          bytes: Buffer.from('{"type":"FeatureCollection"}'),
        },
      ],
      primaryFilename: 'layer.geojson',
    });
    expect(replaced.status).toBe('pending');
    expect(replaced.processingStage).toBe('uploading');
    expect(replaced.processingAttempts).toBeUndefined();
    expect(replaced.processingStartedAt).toBeUndefined();
    expect(replaced.failureReason).toBeUndefined();
    expect(replaced.storedAttachments).toBeUndefined();

    await storeOriginalsFromStaging(replaced._id);
    await processMapAsset(replaced._id, {
      now: () => T0,
      claimTimeoutMs: CLAIM_TIMEOUT_MS,
      claimHeartbeatMs: 0,
    });
    const finished = await getMapAsset(replaced._id);
    expect(finished.status).toBe('ready');
    expect(finished.processingAttempts).toBe(1);
  });

  it('writes pipeline stages onto the asset while the worker runs', async () => {
    const asset = await createStoredAsset();
    expect(asset.processingStage).toBe('queued');
    const seen: Array<string | undefined> = [];
    normalizeMapUpload.mockImplementation(async (_files, context) => {
      seen.push((await getMapAsset(asset._id)).processingStage);
      await context?.onStage?.('interpreting-crs');
      seen.push((await getMapAsset(asset._id)).processingStage);
      await context?.onStage?.('converting-geometries');
      seen.push((await getMapAsset(asset._id)).processingStage);
      return normalizedFixture();
    });
    await processMapAsset(asset._id, {
      now: () => T0,
      claimTimeoutMs: CLAIM_TIMEOUT_MS,
      claimHeartbeatMs: 0,
    });
    expect(seen).toEqual([
      'downloading',
      'interpreting-crs',
      'converting-geometries',
    ]);
    expect((await getMapAsset(asset._id)).processingStage).toBeUndefined();
  });

  it('counts pending stored jobs as unclaimed and claimed jobs as in flight', async () => {
    await createStoredAsset();
    const claimed = await createStoredAsset();
    await getMapAssetsDB().put({
      ...claimed,
      status: 'processing',
      processingStartedAt: T0,
      processingAttempts: 1,
    });
    const staged = await createPendingAsset();
    expect(staged.status).toBe('pending');
    expect(staged.processingStage).toBe('uploading');
    expect(
      await summarizeSpatialBacklog({
        now: () => T0,
        claimTimeoutMs: CLAIM_TIMEOUT_MS,
      })
    ).toEqual({inFlight: 1, unclaimed: 1});
  });
});
