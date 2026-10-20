// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {
  assignDownloadedLayer,
  filenamesToDelete,
  layerDeviceStatus,
  releaseProjectLayers,
  retainListedLayers,
  type StoredLayerRef,
} from './contextualLayerIndex';

function file(
  assetId: string,
  contentHash: string,
  projectIds: string[]
): StoredLayerRef {
  return {
    assetId,
    contentHash,
    filename: `${assetId}-${contentHash}.pmtiles`,
    projectIds,
  };
}

describe('contextual layer device index', () => {
  it('keeps a single record when the same asset is downloaded for two surveys', () => {
    const first = assignDownloadedLayer(
      {},
      'survey-a',
      file('asset-1', 'hash-a', ['survey-a'])
    );
    const second = assignDownloadedLayer(
      first,
      'survey-b',
      file('asset-1', 'hash-a', ['survey-b'])
    );

    expect(Object.keys(second)).toEqual(['asset-1']);
    expect(second['asset-1'].projectIds).toEqual(['survey-a', 'survey-b']);
    expect(filenamesToDelete(first, second)).toEqual([]);
  });

  it('replaces a stale hash and names the old file for deletion', () => {
    const current = {
      'asset-1': file('asset-1', 'hash-a', ['survey-a', 'survey-b']),
    };
    const next = assignDownloadedLayer(
      current,
      'survey-a',
      file('asset-1', 'hash-b', ['survey-a'])
    );

    expect(Object.keys(next)).toEqual(['asset-1']);
    expect(next['asset-1'].contentHash).toBe('hash-b');
    expect(next['asset-1'].filename).toBe('asset-1-hash-b.pmtiles');
    expect(next['asset-1'].projectIds).toEqual(['survey-a', 'survey-b']);
    expect(filenamesToDelete(current, next)).toEqual([
      'asset-1-hash-a.pmtiles',
    ]);
  });

  it('keeps a shared file when one survey is deactivated', () => {
    const current = {
      'asset-1': file('asset-1', 'hash-a', ['survey-a', 'survey-b']),
    };
    const next = releaseProjectLayers(current, 'survey-a');

    expect(next['asset-1'].projectIds).toEqual(['survey-b']);
    expect(filenamesToDelete(current, next)).toEqual([]);
  });

  it('deletes the file when the last survey is deactivated', () => {
    const current = {
      'asset-1': file('asset-1', 'hash-a', ['survey-a']),
    };
    const next = releaseProjectLayers(current, 'survey-a');

    expect(next['asset-1']).toBeUndefined();
    expect(filenamesToDelete(current, next)).toEqual([
      'asset-1-hash-a.pmtiles',
    ]);
  });

  it('drops an unlinked asset for one survey and leaves other surveys alone', () => {
    const current = {
      'asset-1': file('asset-1', 'hash-a', ['survey-a', 'survey-b']),
      'asset-2': file('asset-2', 'hash-c', ['survey-a']),
    };
    const next = retainListedLayers(current, 'survey-a', ['asset-1']);

    expect(next['asset-1'].projectIds).toEqual(['survey-a', 'survey-b']);
    expect(next['asset-2']).toBeUndefined();
    expect(filenamesToDelete(current, next)).toEqual([
      'asset-2-hash-c.pmtiles',
    ]);
  });
});

describe('layerDeviceStatus', () => {
  const stored = new Map([
    ['asset-1', {contentHash: 'hash-a'}],
    ['asset-2', {contentHash: 'hash-old'}],
  ]);

  it('marks a matching stored file as already on the device', () => {
    expect(
      layerDeviceStatus({id: 'asset-1', contentHash: 'hash-a'}, stored)
    ).toBe('on-device');
  });

  it('marks a stored file with a different hash as an update', () => {
    expect(
      layerDeviceStatus({id: 'asset-2', contentHash: 'hash-new'}, stored)
    ).toBe('update');
  });

  it('marks a missing file as not downloaded', () => {
    expect(
      layerDeviceStatus({id: 'asset-3', contentHash: 'hash-a'}, stored)
    ).toBe('not-downloaded');
  });
});
