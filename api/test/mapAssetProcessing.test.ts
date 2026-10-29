// SPDX-License-Identifier: Apache-2.0
import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {getMapAssetsDB} from '../src/couchdb';
import {
  MAP_ASSET_ORIGINAL_STORE_MAX_ATTEMPTS,
  MAP_ASSET_ORIGINAL_STORE_TIMEOUT_MS,
  MAP_ASSET_ORIGINAL_STORE_TIMEOUT_REASON,
  MAP_ASSET_ORIGINALS_MISSING_REASON,
  MAP_ASSET_PROCESSING_EXHAUSTED_REASON,
  MAP_ASSET_PROCESSING_MAX_ATTEMPTS,
  MAP_ASSET_PROCESSING_USER_HINT,
  createMapAsset,
  deleteMapAsset,
  failStaleOriginalStores,
  findUnclaimedSpatialJob,
  getMapAsset,
  mapAssetIsClaimable,
  mapAssetOriginalStoreRetryPhase,
  originalStoreIsTimedOut,
  processMapAsset,
  replaceMapAssetFiles,
  storeOriginalsFromStaging,
  storeOriginalsFromStagingWithRetry,
  summarizeSpatialBacklog,
  updateMapAssetDetails,
} from '../src/couchdb/mapAssets/store';
import {attachmentStorageService} from '../src/buildconfig';
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

/** Park the next object-store put until `release`, then restore the service. */
function holdNextAttachmentUpload() {
  let markStarted: () => void = () => undefined;
  let releaseUpload: (location: {
    provider: 's3';
    resourceUri: string;
    contentType: string;
    byteSize: number;
  }) => void = () => undefined;
  const started = new Promise<void>(resolve => {
    markStarted = resolve;
  });
  const held = new Promise<{
    provider: 's3';
    resourceUri: string;
    contentType: string;
    byteSize: number;
  }>(resolve => {
    releaseUpload = resolve;
  });
  const spy = vi
    .spyOn(attachmentStorageService, 'upload')
    .mockImplementation(async ({key, contentType, contentLength}) => {
      markStarted();
      const released = await held;
      return {
        provider: 's3',
        resourceUri: released.resourceUri || `s3://us-east-1/bucket/${key}`,
        contentType: contentType || released.contentType,
        byteSize: contentLength ?? released.byteSize,
      };
    });
  return {
    started,
    release: () =>
      releaseUpload({
        provider: 's3',
        resourceUri: 's3://us-east-1/bucket/stale-original',
        contentType: 'application/octet-stream',
        byteSize: 2,
      }),
    restore: () => spy.mockRestore(),
  };
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
        {status: 'processing', processingHeartbeatMs: T0 - CLAIM_TIMEOUT_MS},
        T0,
        CLAIM_TIMEOUT_MS
      )
    ).toBe(true);
    expect(
      mapAssetIsClaimable(
        {
          status: 'processing',
          processingHeartbeatMs: T0 - CLAIM_TIMEOUT_MS + 1,
        },
        T0,
        CLAIM_TIMEOUT_MS
      )
    ).toBe(false);
    expect(
      mapAssetIsClaimable(
        {
          status: 'processing',
          processingStartedAt: T0 - CLAIM_TIMEOUT_MS,
          processingHeartbeatMs: T0,
        },
        T0,
        CLAIM_TIMEOUT_MS
      )
    ).toBe(false);
    expect(
      mapAssetIsClaimable(
        {
          status: 'processing',
          processingStartedAt: T0,
          processingHeartbeatMs: T0 - CLAIM_TIMEOUT_MS,
        },
        T0,
        CLAIM_TIMEOUT_MS
      )
    ).toBe(true);
    expect(
      mapAssetIsClaimable(
        {status: 'ready', processingHeartbeatMs: T0 - CLAIM_TIMEOUT_MS},
        T0,
        CLAIM_TIMEOUT_MS
      )
    ).toBe(false);
    expect(mapAssetIsClaimable({status: 'failed'}, T0, CLAIM_TIMEOUT_MS)).toBe(
      false
    );
  });

  it('treats a pending upload without originals as timed out after 2 hours', () => {
    const started = T0 - MAP_ASSET_ORIGINAL_STORE_TIMEOUT_MS;
    expect(
      originalStoreIsTimedOut(
        {status: 'pending', originalUploadStartedMs: started},
        T0
      )
    ).toBe(true);
    expect(
      originalStoreIsTimedOut(
        {status: 'pending', originalUploadStartedMs: started + 1},
        T0
      )
    ).toBe(false);
    expect(
      originalStoreIsTimedOut(
        {
          status: 'pending',
          originalUploadStartedMs: started,
          createdAt: started,
          updatedAt: T0,
        },
        T0
      )
    ).toBe(true);
    expect(
      originalStoreIsTimedOut(
        {
          status: 'pending',
          originalUploadStartedMs: T0,
          createdAt: started,
          updatedAt: T0,
        },
        T0
      )
    ).toBe(false);
    expect(
      originalStoreIsTimedOut(
        {status: 'pending', createdAt: started, updatedAt: T0},
        T0
      )
    ).toBe(true);
    expect(
      originalStoreIsTimedOut(
        {status: 'ready', originalUploadStartedMs: started},
        T0
      )
    ).toBe(false);
    expect(
      originalStoreIsTimedOut(
        {
          status: 'pending',
          originalUploadStartedMs: started,
          storedAttachments: {
            original: {
              provider: 's3',
              resourceUri: 's3://bucket/original',
              contentType: 'application/geo+json',
              byteSize: 2,
            },
          },
        },
        T0
      )
    ).toBe(false);
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
    expect(await storeOriginalsFromStaging(asset._id)).toBe(true);
    const finished = await getMapAsset(asset._id);
    expect(finished.status).toBe('pending');
    expect(finished.processingStage).toBe('queued');
    expect(finished.processingAttempts).toBeUndefined();
    expect(finished.storedAttachments?.original?.provider).toBe('s3');
    expect(finished.storedAttachments?.original?.resourceUri).toContain(
      asset._id
    );
    expect(finished.storedAttachments?.normalized).toBeUndefined();
    expect(finished.processingHeartbeatMs).toEqual(expect.any(Number));
    expect(finished.updatedAt).toBe(asset.updatedAt);
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

  it('records retry progress then stores originals on a later attempt', async () => {
    const asset = await createPendingAsset();
    const phases: Array<string | undefined> = [];
    const store = vi
      .fn()
      .mockRejectedValueOnce(new Error('S3 unavailable'))
      .mockRejectedValueOnce(new Error('S3 unavailable'))
      .mockResolvedValueOnce(true);

    await storeOriginalsFromStagingWithRetry(asset._id, {
      store,
      delayMs: 0,
      sleep: async () => {
        phases.push((await getMapAsset(asset._id)).processingProgress?.phase);
      },
    });

    expect(store).toHaveBeenCalledTimes(3);
    expect(phases).toEqual([
      mapAssetOriginalStoreRetryPhase(1),
      mapAssetOriginalStoreRetryPhase(2),
    ]);
    expect(mapAssetOriginalStoreRetryPhase(1).length).toBeLessThanOrEqual(80);
    const current = await getMapAsset(asset._id);
    expect(current.status).toBe('pending');
    expect(current.failureReason).toBeUndefined();
  });

  it('marks the asset failed after the original-upload retries are exhausted', async () => {
    const asset = await createPendingAsset();
    await storeOriginalsFromStagingWithRetry(asset._id, {
      store: async () => {
        throw new Error('S3 unavailable');
      },
      delayMs: 0,
    });

    const failed = await getMapAsset(asset._id);
    expect(failed.status).toBe('failed');
    expect(failed.processingStage).toBeUndefined();
    expect(failed.processingProgress).toBeUndefined();
    expect(failed.failureReason).toContain('after 3 attempts');
    expect(failed.failureReason).toContain('S3 unavailable');
    expect(failed.failureReason).toContain(MAP_ASSET_PROCESSING_USER_HINT);
    expect(
      await findUnclaimedSpatialJob({
        now: () => T0,
        claimTimeoutMs: CLAIM_TIMEOUT_MS,
      })
    ).toBeUndefined();

    const replaced = await replaceMapAssetFiles({
      assetId: failed._id,
      files: [{filename: 'layer.geojson', bytes: Buffer.from('{}')}],
      primaryFilename: 'layer.geojson',
    });
    expect(replaced.status).toBe('pending');
    expect(replaced.failureReason).toBeUndefined();
  });

  it('marks the asset failed when staged originals never appear', async () => {
    const asset = await createPendingAsset();
    await storeOriginalsFromStagingWithRetry(asset._id, {
      store: async () => false,
      delayMs: 0,
    });
    const failed = await getMapAsset(asset._id);
    expect(failed.status).toBe('failed');
    expect(failed.failureReason).toBe(MAP_ASSET_ORIGINALS_MISSING_REASON);
    expect(MAP_ASSET_ORIGINAL_STORE_MAX_ATTEMPTS).toBe(3);
  });

  it('fails a pending upload with no originals after the 2 hour timeout', async () => {
    const asset = await createPendingAsset();
    const started = T0 - MAP_ASSET_ORIGINAL_STORE_TIMEOUT_MS;
    await getMapAssetsDB().put({
      ...asset,
      createdAt: started,
      updatedAt: started,
      originalUploadStartedMs: started,
    });

    expect(await failStaleOriginalStores({now: () => T0})).toBe(1);

    const failed = await getMapAsset(asset._id);
    expect(failed.status).toBe('failed');
    expect(failed.failureReason).toBe(MAP_ASSET_ORIGINAL_STORE_TIMEOUT_REASON);
    expect(failed.processingStage).toBeUndefined();
    expect(
      await findUnclaimedSpatialJob({
        now: () => T0,
        claimTimeoutMs: CLAIM_TIMEOUT_MS,
      })
    ).toBeUndefined();

    const replaced = await replaceMapAssetFiles({
      assetId: failed._id,
      files: [{filename: 'layer.geojson', bytes: Buffer.from('{}')}],
      primaryFilename: 'layer.geojson',
    });
    expect(replaced.status).toBe('pending');
    expect(replaced.failureReason).toBeUndefined();
    expect(replaced.createdAt).toBe(started);
    expect(replaced.originalUploadStartedMs).toBeGreaterThan(started);
    expect(await failStaleOriginalStores({now: () => T0})).toBe(0);
    expect((await getMapAsset(replaced._id)).status).toBe('pending');
  });

  it('does not reset the original-upload timeout when the layer is renamed', async () => {
    const asset = await createPendingAsset();
    const started = T0 - MAP_ASSET_ORIGINAL_STORE_TIMEOUT_MS;
    await getMapAssetsDB().put({
      ...asset,
      createdAt: started,
      updatedAt: started,
      originalUploadStartedMs: started,
    });
    const renamed = await updateMapAssetDetails({
      assetId: asset._id,
      name: 'Renamed',
      description: '',
    });
    expect(renamed.updatedAt).toBeGreaterThan(started);
    expect(renamed.originalUploadStartedMs).toBe(started);
    expect(await failStaleOriginalStores({now: () => T0})).toBe(1);
    expect((await getMapAsset(asset._id)).status).toBe('failed');
  });

  it('does not fail a fresh upload or one that already stored originals', async () => {
    const pending = await createPendingAsset();
    const stored = await createStoredAsset();
    await getMapAssetsDB().put({
      ...(await getMapAsset(stored._id)),
      updatedAt: T0 - MAP_ASSET_ORIGINAL_STORE_TIMEOUT_MS,
    });

    expect(await failStaleOriginalStores({now: () => T0})).toBe(0);
    expect((await getMapAsset(pending._id)).status).toBe('pending');
    expect((await getMapAsset(stored._id)).status).toBe('pending');
  });

  it('does not fail an asset that was deleted during the original upload', async () => {
    const asset = await createPendingAsset();
    await deleteMapAsset(asset._id);
    await storeOriginalsFromStagingWithRetry(asset._id, {delayMs: 0});
    await expect(getMapAsset(asset._id)).rejects.toMatchObject({status: 404});
  });

  it('clears retry progress when originals land', async () => {
    const asset = await createPendingAsset();
    await getMapAssetsDB().put({
      ...asset,
      processingProgress: {
        phase: mapAssetOriginalStoreRetryPhase(1),
      },
    });
    expect(await storeOriginalsFromStaging(asset._id)).toBe(true);
    const finished = await getMapAsset(asset._id);
    expect(finished.processingStage).toBe('queued');
    expect(finished.processingProgress).toBeUndefined();
  });

  it('marks the asset failed when the live original upload exceeds the timeout', async () => {
    const asset = await createPendingAsset();
    let resolveStore: (value: boolean) => void = () => undefined;
    const store = vi.fn(
      () =>
        new Promise<boolean>(resolve => {
          resolveStore = resolve;
        })
    );

    await storeOriginalsFromStagingWithRetry(asset._id, {
      timeoutMs: 30,
      store,
      delayMs: 0,
    });

    const failed = await getMapAsset(asset._id);
    expect(failed.status).toBe('failed');
    expect(failed.failureReason).toBe(MAP_ASSET_ORIGINAL_STORE_TIMEOUT_REASON);
    expect(failed.processingStage).toBeUndefined();
    resolveStore(true);
    expect((await getMapAsset(asset._id)).status).toBe('failed');
    expect((await getMapAsset(asset._id)).storedAttachments).toBeUndefined();
  });

  it('does not write originals onto an asset that failed during the object-store put', async () => {
    const asset = await createPendingAsset();
    const upload = holdNextAttachmentUpload();
    const storing = storeOriginalsFromStaging(asset._id);
    await upload.started;

    await getMapAssetsDB().put({
      ...(await getMapAsset(asset._id)),
      status: 'failed',
      failureReason: MAP_ASSET_ORIGINAL_STORE_TIMEOUT_REASON,
      processingStage: undefined,
      processingProgress: undefined,
    });
    upload.release();

    expect(await storing).toBe(false);
    const latest = await getMapAsset(asset._id);
    expect(latest.status).toBe('failed');
    expect(latest.storedAttachments).toBeUndefined();
    upload.restore();
  });

  it('does not write a late original put onto a replaced upload or delete its staging', async () => {
    const asset = await createPendingAsset();
    const upload = holdNextAttachmentUpload();
    const storing = storeOriginalsFromStaging(asset._id);
    await upload.started;

    await getMapAssetsDB().put({
      ...(await getMapAsset(asset._id)),
      status: 'failed',
      failureReason: MAP_ASSET_ORIGINAL_STORE_TIMEOUT_REASON,
      processingStage: undefined,
      processingProgress: undefined,
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
    expect(replaced.originalUploadStartedMs).not.toBe(
      asset.originalUploadStartedMs
    );
    upload.release();

    expect(await storing).toBe(false);
    upload.restore();

    const latest = await getMapAsset(replaced._id);
    expect(latest.status).toBe('pending');
    expect(latest.processingStage).toBe('uploading');
    expect(latest.storedAttachments).toBeUndefined();
    expect(await storeOriginalsFromStaging(replaced._id)).toBe(true);
    expect(
      (await getMapAsset(replaced._id)).storedAttachments?.original?.provider
    ).toBe('s3');
  });

  it('still stores originals after a rename during the object-store put', async () => {
    const asset = await createPendingAsset();
    const upload = holdNextAttachmentUpload();
    const storing = storeOriginalsFromStaging(asset._id);
    await upload.started;

    await updateMapAssetDetails({
      assetId: asset._id,
      name: 'Renamed',
      description: '',
    });
    upload.release();

    expect(await storing).toBe(true);
    upload.restore();
    const latest = await getMapAsset(asset._id);
    expect(latest.name).toBe('Renamed');
    expect(latest.originalUploadStartedMs).toBe(asset.originalUploadStartedMs);
    expect(latest.storedAttachments?.original?.provider).toBe('s3');
    expect(latest.processingStage).toBe('queued');
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
    });
    const finished = await getMapAsset(asset._id);
    expect(finished.status).toBe('ready');
    expect(finished.processingAttempts).toBe(1);
    expect(finished.processingStartedAt).toBeUndefined();
    expect(finished.processingHeartbeatMs).toBeUndefined();
    expect(finished.processingStage).toBeUndefined();
    expect(finished.updatedAt).toBe(T0);
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
      processingHeartbeatMs: T0 - CLAIM_TIMEOUT_MS,
    });

    await processMapAsset(asset._id, {
      now: () => T0,
      claimTimeoutMs: CLAIM_TIMEOUT_MS,
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
    });

    const failed = await getMapAsset(asset._id);
    expect(failed.status).toBe('failed');
    expect(failed.failureReason).toBe(
      `no crs. ${MAP_ASSET_PROCESSING_USER_HINT}`
    );
    expect(failed.processingAttempts).toBe(1);
    expect(
      await findUnclaimedSpatialJob({
        now: () => T0 + CLAIM_TIMEOUT_MS,
        claimTimeoutMs: CLAIM_TIMEOUT_MS,
      })
    ).toBeUndefined();
  });

  it('returns when the asset is deleted before the worker claims it', async () => {
    const asset = await createStoredAsset();
    await deleteMapAsset(asset._id);
    await expect(
      processMapAsset(asset._id, {
        now: () => T0,
        claimTimeoutMs: CLAIM_TIMEOUT_MS,
      })
    ).resolves.toBeUndefined();
    expect(normalizeMapUpload).not.toHaveBeenCalled();
  });

  it('returns when the asset is deleted during processing', async () => {
    const asset = await createStoredAsset();
    normalizeMapUpload.mockImplementation(async () => {
      await deleteMapAsset(asset._id);
      return normalizedFixture();
    });
    await expect(
      processMapAsset(asset._id, {
        now: () => T0,
        claimTimeoutMs: CLAIM_TIMEOUT_MS,
      })
    ).resolves.toBeUndefined();
    await expect(getMapAsset(asset._id)).rejects.toMatchObject({
      status: 404,
    });
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
    expect(replaced.processingHeartbeatMs).toBeUndefined();
    expect(replaced.failureReason).toBeUndefined();
    expect(replaced.storedAttachments).toBeUndefined();

    await storeOriginalsFromStaging(replaced._id);
    await processMapAsset(replaced._id, {
      now: () => T0,
      claimTimeoutMs: CLAIM_TIMEOUT_MS,
    });
    const finished = await getMapAsset(replaced._id);
    expect(finished.status).toBe('ready');
    expect(finished.processingAttempts).toBe(1);
  });

  it('restores the previous layer when replace staging fails', async () => {
    const asset = await createStoredAsset();
    await processMapAsset(asset._id, {
      now: () => T0,
      claimTimeoutMs: CLAIM_TIMEOUT_MS,
    });
    const ready = await getMapAsset(asset._id);
    expect(ready.status).toBe('ready');

    await expect(
      replaceMapAssetFiles({
        assetId: ready._id,
        files: [{filename: 'replacement.geojson'}],
        primaryFilename: 'replacement.geojson',
      })
    ).rejects.toThrow(/missing data/);

    const restored = await getMapAsset(ready._id);
    expect(restored.status).toBe('ready');
    expect(restored.originalFilename).toBe(ready.originalFilename);
    expect(restored.kind).toBe(ready.kind);
    expect(restored.contentHash).toBe(ready.contentHash);
    expect(restored.storedAttachments).toEqual(ready.storedAttachments);
    expect(restored.failureReason).toBeUndefined();

    const replaced = await replaceMapAssetFiles({
      assetId: ready._id,
      files: [
        {
          filename: 'replacement.geojson',
          bytes: Buffer.from('{"type":"FeatureCollection"}'),
        },
      ],
      primaryFilename: 'replacement.geojson',
    });
    expect(replaced.status).toBe('pending');
    expect(replaced.storedAttachments).toBeUndefined();
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
    });
    expect(seen).toEqual([
      'downloading',
      'interpreting-crs',
      'converting-geometries',
    ]);
    expect((await getMapAsset(asset._id)).processingStage).toBeUndefined();
    expect((await getMapAsset(asset._id)).processingProgress).toBeUndefined();
  });

  it('writes processingProgress while warping and clears it when ready', async () => {
    const asset = await createStoredAsset();
    normalizeMapUpload.mockImplementation(async (_files, context) => {
      await context?.onStage?.('warping-raster');
      await context?.onProgress?.({
        phase: 'Warping',
        percent: 22.5,
      });
      const during = await getMapAsset(asset._id);
      expect(during.processingStage).toBe('warping-raster');
      expect(during.processingProgress).toEqual({
        phase: 'Warping',
        percent: 22.5,
      });
      expect(during.processingHeartbeatMs).toBe(T0);
      expect(during.updatedAt).toBe(asset.updatedAt);
      return normalizedFixture();
    });
    await processMapAsset(asset._id, {
      now: () => T0,
      claimTimeoutMs: CLAIM_TIMEOUT_MS,
    });
    const finished = await getMapAsset(asset._id);
    expect(finished.status).toBe('ready');
    expect(finished.processingStage).toBeUndefined();
    expect(finished.processingProgress).toBeUndefined();
  });

  it('writes processingProgress while tiling and clears it when ready', async () => {
    const asset = await createStoredAsset();
    normalizeMapUpload.mockImplementation(async (_files, context) => {
      await context?.onStage?.('tiling-vectors');
      await context?.onProgress?.({
        phase: 'Reordering geometry',
        percent: 45,
      });
      const during = await getMapAsset(asset._id);
      expect(during.processingStage).toBe('tiling-vectors');
      expect(during.processingProgress).toEqual({
        phase: 'Reordering geometry',
        percent: 45,
      });
      const rev = during._rev;
      await context?.onProgress?.({
        phase: 'Reordering geometry',
        percent: 45,
      });
      expect((await getMapAsset(asset._id))._rev).toBe(rev);
      return normalizedFixture();
    });
    await processMapAsset(asset._id, {
      now: () => T0,
      claimTimeoutMs: CLAIM_TIMEOUT_MS,
    });
    const finished = await getMapAsset(asset._id);
    expect(finished.status).toBe('ready');
    expect(finished.processingStage).toBeUndefined();
    expect(finished.processingProgress).toBeUndefined();
  });

  it('counts pending stored jobs as unclaimed and claimed jobs as in flight', async () => {
    await createStoredAsset();
    const claimed = await createStoredAsset();
    await getMapAssetsDB().put({
      ...claimed,
      status: 'processing',
      processingStartedAt: T0,
      processingAttempts: 1,
      processingHeartbeatMs: T0,
    });
    const staged = await createPendingAsset();
    expect(staged.status).toBe('pending');
    expect(staged.processingStage).toBe('uploading');
    expect(
      await summarizeSpatialBacklog({
        now: () => T0,
        claimTimeoutMs: CLAIM_TIMEOUT_MS,
      })
    ).toEqual({
      inFlight: 1,
      unclaimed: 1,
      oldestUnclaimedMs: expect.any(Number),
    });
  });

  it('reports the age of the oldest unclaimed stored job', async () => {
    const older = await createStoredAsset();
    const newer = await createStoredAsset();
    const claimed = await createStoredAsset();
    const db = getMapAssetsDB();
    await db.put({
      ...older,
      updatedAt: T0 - 180_000,
      createdAt: T0 - 180_000,
    });
    await db.put({
      ...newer,
      updatedAt: T0 - 30_000,
      createdAt: T0 - 30_000,
    });
    await db.put({
      ...claimed,
      status: 'processing',
      processingStartedAt: T0,
      processingAttempts: 1,
      processingHeartbeatMs: T0,
    });
    expect(
      await summarizeSpatialBacklog({
        now: () => T0,
        claimTimeoutMs: CLAIM_TIMEOUT_MS,
      })
    ).toEqual({inFlight: 1, unclaimed: 2, oldestUnclaimedMs: 180_000});
  });

  it('treats a processing job as unclaimed after the last state change ages out', async () => {
    const asset = await createStoredAsset();
    await getMapAssetsDB().put({
      ...asset,
      status: 'processing',
      processingStartedAt: T0,
      processingAttempts: 1,
      processingStage: 'tiling-vectors',
      processingHeartbeatMs: T0 - CLAIM_TIMEOUT_MS,
    });
    expect(
      await findUnclaimedSpatialJob({
        now: () => T0,
        claimTimeoutMs: CLAIM_TIMEOUT_MS,
      })
    ).toBe(asset._id);
  });

  it('does not treat a rename as a processing heartbeat', async () => {
    const asset = await createStoredAsset();
    const createdUpdatedAt = asset.updatedAt;
    await getMapAssetsDB().put({
      ...asset,
      status: 'processing',
      processingStartedAt: T0,
      processingAttempts: 1,
      processingStage: 'tiling-vectors',
      processingHeartbeatMs: T0 - CLAIM_TIMEOUT_MS,
    });
    const renamed = await updateMapAssetDetails({
      assetId: asset._id,
      name: 'Renamed',
      description: 'updated',
    });
    expect(renamed.name).toBe('Renamed');
    expect(renamed.updatedAt).toBeGreaterThan(createdUpdatedAt);
    expect(renamed.processingHeartbeatMs).toBe(T0 - CLAIM_TIMEOUT_MS);
    expect(mapAssetIsClaimable(renamed, T0, CLAIM_TIMEOUT_MS)).toBe(true);
    expect(
      await findUnclaimedSpatialJob({
        now: () => T0,
        claimTimeoutMs: CLAIM_TIMEOUT_MS,
      })
    ).toBe(asset._id);
  });
});

describe('map asset details during processing writes', () => {
  beforeAll(async () => {
    await resetDatabases();
  });

  beforeEach(async () => {
    await clearMapAssetDocs();
  });

  it('retries rename when a processing write wins the revision', async () => {
    const asset = await createPendingAsset();
    const db = getMapAssetsDB();
    const put = db.put.bind(db);
    let injected = false;
    const spy = vi.spyOn(db, 'put').mockImplementation(async doc => {
      if (!injected && 'name' in doc && doc.name === 'Renamed') {
        injected = true;
        const latest = await db.get(asset._id);
        await put({
          ...latest,
          processingStage: 'warping-raster',
          processingProgress: {phase: 'Warping', percent: 10},
        });
      }
      return put(doc);
    });
    try {
      const updated = await updateMapAssetDetails({
        assetId: asset._id,
        name: 'Renamed',
        description: 'updated',
      });
      expect(updated.name).toBe('Renamed');
      expect(updated.description).toBe('updated');
      expect(updated.processingStage).toBe('warping-raster');
      expect(updated.processingProgress).toEqual({
        phase: 'Warping',
        percent: 10,
      });
    } finally {
      spy.mockRestore();
    }
  });

  it('retries delete when a processing write wins the revision', async () => {
    const asset = await createPendingAsset();
    const db = getMapAssetsDB();
    const put = db.put.bind(db);
    const remove = db.remove.bind(db);
    let injected = false;
    const spy = vi.spyOn(db, 'remove').mockImplementation(async doc => {
      const id = typeof doc === 'string' ? doc : doc._id;
      if (!injected && id === asset._id) {
        injected = true;
        const latest = await db.get(asset._id);
        await put({
          ...latest,
          processingStage: 'warping-raster',
        });
      }
      return remove(doc);
    });
    try {
      await deleteMapAsset(asset._id);
      await expect(getMapAsset(asset._id)).rejects.toMatchObject({
        status: 404,
      });
    } finally {
      spy.mockRestore();
    }
  });
});
