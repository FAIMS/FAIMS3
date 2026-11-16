// SPDX-License-Identifier: Apache-2.0
import {mkdtemp, readFile, rm, writeFile} from 'fs/promises';
import {tmpdir} from 'os';
import path from 'path';
import {afterEach, describe, expect, it, vi} from 'vitest';

const mocks = vi.hoisted(() => ({
  rename: vi.fn(),
}));

vi.mock('fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('fs/promises')>();
  mocks.rename.mockImplementation(actual.rename);
  return {
    ...actual,
    rename: (...args: Parameters<typeof actual.rename>) =>
      mocks.rename(...args),
  };
});

import {
  cleanupStaging,
  mapAssetStagingDir,
  moveOrCopy,
  readStagedFiles,
  stageUploadFiles,
} from '../src/couchdb/mapAssets/staging';

describe('map asset staging', () => {
  const assetIds: string[] = [];
  const extraDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(assetIds.splice(0).map(id => cleanupStaging(id)));
    await Promise.all(
      extraDirs.splice(0).map(dir => rm(dir, {recursive: true, force: true}))
    );
    vi.restoreAllMocks();
  });

  it('returns undefined when any staged path is missing', async () => {
    const assetId = `missing-${Date.now()}`;
    assetIds.push(assetId);
    await expect(
      readStagedFiles(assetId, ['sites.geojson'])
    ).resolves.toBeUndefined();
  });

  it('throws when an upload has neither bytes nor a disk path', async () => {
    const assetId = `empty-${Date.now()}`;
    assetIds.push(assetId);
    await expect(
      stageUploadFiles(assetId, [{filename: 'sites.geojson'}])
    ).rejects.toThrow(/missing data/);
  });

  it('writes in-memory bytes and then reads them back', async () => {
    const assetId = `bytes-${Date.now()}`;
    assetIds.push(assetId);
    const staged = await stageUploadFiles(assetId, [
      {
        filename: 'sites.geojson',
        bytes: Buffer.from('{"type":"FeatureCollection"}'),
      },
    ]);
    expect(staged[0]?.diskPath).toBe(
      path.join(mapAssetStagingDir(assetId), 'sites.geojson')
    );
    const again = await readStagedFiles(assetId, ['sites.geojson']);
    expect(again?.[0]?.filename).toBe('sites.geojson');
    expect(again?.[0]?.size).toBeGreaterThan(0);
  });

  it('copies then unlinks when rename fails across filesystems', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'map-asset-move-'));
    extraDirs.push(dir);
    const from = path.join(dir, 'from.geojson');
    const to = path.join(dir, 'to.geojson');
    await writeFile(from, 'payload');
    mocks.rename.mockRejectedValueOnce(new Error('EXDEV'));
    await moveOrCopy(from, to);
    expect(mocks.rename).toHaveBeenCalled();
    await expect(readFile(to, 'utf8')).resolves.toBe('payload');
    await expect(readFile(from, 'utf8')).rejects.toThrow();
  });
});
