// SPDX-License-Identifier: Apache-2.0
import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {getMapAssetsDB} from '../src/couchdb';
import {
  MAP_ASSET_PROCESSING_EXHAUSTED_REASON,
  MAP_ASSET_PROCESSING_MAX_ATTEMPTS,
  createMapAsset,
  getMapAsset,
  mapAssetProcessingClaimIsStale,
  processMapAsset,
  replaceMapAssetFiles,
  sweepStaleMapAssetProcessing,
  waitForMapAssetProcessing,
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
    kind: 'geojson' as const,
    bytes: Buffer.from('{"type":"FeatureCollection","features":[]}'),
    mediaType: 'application/geo+json',
    extent4326: [0, 0, 1, 1] as [number, number, number, number],
  };
}

async function createProcessingAsset() {
  return createMapAsset({
    name: 'Layer',
    description: '',
    createdBy: 'user-1',
    files: [{filename: 'layer.geojson', bytes: Buffer.from('{}')}],
    primaryFilename: 'layer.geojson',
  });
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
  it('treats a missing claim as stale and a fresh claim as held', () => {
    expect(
      mapAssetProcessingClaimIsStale(
        {status: 'processing'},
        T0,
        CLAIM_TIMEOUT_MS
      )
    ).toBe(true);
    expect(
      mapAssetProcessingClaimIsStale(
        {status: 'processing', processingStartedAt: T0 - CLAIM_TIMEOUT_MS},
        T0,
        CLAIM_TIMEOUT_MS
      )
    ).toBe(true);
    expect(
      mapAssetProcessingClaimIsStale(
        {
          status: 'processing',
          processingStartedAt: T0 - CLAIM_TIMEOUT_MS + 1,
        },
        T0,
        CLAIM_TIMEOUT_MS
      )
    ).toBe(false);
    expect(
      mapAssetProcessingClaimIsStale(
        {status: 'ready', processingStartedAt: T0 - CLAIM_TIMEOUT_MS},
        T0,
        CLAIM_TIMEOUT_MS
      )
    ).toBe(false);
  });
});

describe('map asset processing sweep', () => {
  beforeAll(async () => {
    await resetDatabases();
  });

  beforeEach(async () => {
    await waitForMapAssetProcessing();
    await clearMapAssetDocs();
    normalizeMapUpload.mockReset();
    normalizeMapUpload.mockResolvedValue(normalizedFixture());
  });

  it('retries an unclaimed processing asset from a sweep', async () => {
    const asset = await createProcessingAsset();
    const enqueued = await sweepStaleMapAssetProcessing({
      now: () => T0,
      claimTimeoutMs: CLAIM_TIMEOUT_MS,
    });
    expect(enqueued).toEqual([asset._id]);
    await waitForMapAssetProcessing();

    const finished = await getMapAsset(asset._id);
    expect(finished.status).toBe('ready');
    expect(finished.processingAttempts).toBe(1);
    expect(finished.processingStartedAt).toBeUndefined();
    expect(normalizeMapUpload).toHaveBeenCalledOnce();
  });

  it('retries a stale claim and leaves a fresh claim alone', async () => {
    const stale = await createProcessingAsset();
    const fresh = await createProcessingAsset();
    const db = getMapAssetsDB();
    const staleDoc = await getMapAsset(stale._id);
    const freshDoc = await getMapAsset(fresh._id);
    await db.put({
      ...staleDoc,
      processingStartedAt: T0 - CLAIM_TIMEOUT_MS,
      processingAttempts: 1,
    });
    await db.put({
      ...freshDoc,
      processingStartedAt: T0,
      processingAttempts: 1,
    });

    const enqueued = await sweepStaleMapAssetProcessing({
      now: () => T0,
      claimTimeoutMs: CLAIM_TIMEOUT_MS,
    });
    expect(enqueued).toEqual([stale._id]);
    await waitForMapAssetProcessing();

    const retried = await getMapAsset(stale._id);
    expect(retried.status).toBe('ready');
    expect(retried.processingAttempts).toBe(2);
    const held = await getMapAsset(fresh._id);
    expect(held.status).toBe('processing');
    expect(held.processingAttempts).toBe(1);
    expect(held.processingStartedAt).toBe(T0);
  });

  it('marks the asset failed after the attempt cap without running GDAL again', async () => {
    const asset = await createProcessingAsset();
    const current = await getMapAsset(asset._id);
    await getMapAssetsDB().put({
      ...current,
      processingStartedAt: T0 - CLAIM_TIMEOUT_MS,
      processingAttempts: MAP_ASSET_PROCESSING_MAX_ATTEMPTS,
    });

    const enqueued = await sweepStaleMapAssetProcessing({
      now: () => T0,
      claimTimeoutMs: CLAIM_TIMEOUT_MS,
    });
    expect(enqueued).toEqual([asset._id]);
    await waitForMapAssetProcessing();

    const failed = await getMapAsset(asset._id);
    expect(failed.status).toBe('failed');
    expect(failed.failureReason).toBe(MAP_ASSET_PROCESSING_EXHAUSTED_REASON);
    expect(failed.processingStartedAt).toBeUndefined();
    expect(normalizeMapUpload).not.toHaveBeenCalled();
  });

  it('fails a GDAL error immediately and does not sweep it again', async () => {
    normalizeMapUpload.mockRejectedValue(new Error('no crs'));
    const asset = await createProcessingAsset();
    await processMapAsset(asset._id, {
      now: () => T0,
      claimTimeoutMs: CLAIM_TIMEOUT_MS,
    });

    const failed = await getMapAsset(asset._id);
    expect(failed.status).toBe('failed');
    expect(failed.failureReason).toBe('no crs');
    expect(failed.processingAttempts).toBe(1);

    const enqueued = await sweepStaleMapAssetProcessing({
      now: () => T0 + CLAIM_TIMEOUT_MS,
      claimTimeoutMs: CLAIM_TIMEOUT_MS,
    });
    expect(enqueued).toEqual([]);
  });

  it('does not let a second claim run GDAL while the first claim is fresh', async () => {
    const asset = await createProcessingAsset();
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
      expect((await getMapAsset(asset._id)).processingAttempts).toBe(1);

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
    const asset = await createProcessingAsset();
    normalizeMapUpload.mockImplementation(async () => {
      const latest = await getMapAsset(asset._id);
      await getMapAssetsDB().put({
        ...latest,
        status: 'ready',
        kind: 'geojson',
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
    const asset = await createProcessingAsset();
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
    expect(replaced.status).toBe('processing');
    expect(replaced.processingAttempts).toBeUndefined();
    expect(replaced.processingStartedAt).toBeUndefined();
    expect(replaced.failureReason).toBeUndefined();

    await processMapAsset(replaced._id, {
      now: () => T0,
      claimTimeoutMs: CLAIM_TIMEOUT_MS,
    });
    const finished = await getMapAsset(replaced._id);
    expect(finished.status).toBe('ready');
    expect(finished.processingAttempts).toBe(1);
  });
});
