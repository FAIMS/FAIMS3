// SPDX-License-Identifier: Apache-2.0
import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {getMapAssetsDB} from '../src/couchdb';
import {
  MAP_ASSET_PROCESSING_EXHAUSTED_REASON,
  MAP_ASSET_PROCESSING_MAX_ATTEMPTS,
  createMapAsset,
  deleteMapAsset,
  findUnclaimedSpatialJob,
  getMapAsset,
  mapAssetIsClaimable,
  processMapAsset,
  replaceMapAssetFiles,
  storeOriginalsFromStaging,
  summarizeSpatialBacklog,
  updateMapAssetDetails,
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
        {status: 'processing', updatedAt: T0 - CLAIM_TIMEOUT_MS},
        T0,
        CLAIM_TIMEOUT_MS
      )
    ).toBe(true);
    expect(
      mapAssetIsClaimable(
        {
          status: 'processing',
          updatedAt: T0 - CLAIM_TIMEOUT_MS + 1,
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
          updatedAt: T0,
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
          updatedAt: T0 - CLAIM_TIMEOUT_MS,
        },
        T0,
        CLAIM_TIMEOUT_MS
      )
    ).toBe(true);
    expect(
      mapAssetIsClaimable(
        {status: 'ready', updatedAt: T0 - CLAIM_TIMEOUT_MS},
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
      updatedAt: T0 - CLAIM_TIMEOUT_MS,
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
      updatedAt: T0,
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
      updatedAt: T0,
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
      updatedAt: T0 - CLAIM_TIMEOUT_MS,
    });
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
