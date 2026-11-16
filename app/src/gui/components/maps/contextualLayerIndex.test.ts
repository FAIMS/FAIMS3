// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {
  assignDownloadedLayer,
  collectActivatedLayerKeepSet,
  filenamesToDelete,
  layerDeviceStatus,
  retainListedLayers,
  unionListedAssetIds,
  type StoredLayerRef,
} from './contextualLayerIndex';

function file(assetId: string, contentHash: string): StoredLayerRef {
  return {
    assetId,
    contentHash,
    filename: `${assetId}-${contentHash}.pmtiles`,
  };
}

describe('contextual layer device index', () => {
  it('keeps a single record when the same asset is downloaded twice', () => {
    const first = assignDownloadedLayer({}, file('asset-1', 'hash-a'));
    const second = assignDownloadedLayer(first, file('asset-1', 'hash-a'));

    expect(Object.keys(second)).toEqual(['asset-1']);
    expect(second['asset-1'].filename).toBe('asset-1-hash-a.pmtiles');
    expect(filenamesToDelete(first, second)).toEqual([]);
  });

  it('replaces a stale hash and names the old file for deletion', () => {
    const current = {
      'asset-1': file('asset-1', 'hash-a'),
    };
    const next = assignDownloadedLayer(current, file('asset-1', 'hash-b'));

    expect(Object.keys(next)).toEqual(['asset-1']);
    expect(next['asset-1'].contentHash).toBe('hash-b');
    expect(next['asset-1'].filename).toBe('asset-1-hash-b.pmtiles');
    expect(filenamesToDelete(current, next)).toEqual([
      'asset-1-hash-a.pmtiles',
    ]);
  });

  it('keeps a shared file when the keep-set still lists it', () => {
    const current = {
      'asset-1': file('asset-1', 'hash-a'),
    };
    const next = retainListedLayers(current, ['asset-1']);

    expect(next['asset-1']).toEqual(current['asset-1']);
    expect(filenamesToDelete(current, next)).toEqual([]);
  });

  it('deletes the file when no survey still lists it', () => {
    const current = {
      'asset-1': file('asset-1', 'hash-a'),
    };
    const next = retainListedLayers(current, []);

    expect(next['asset-1']).toBeUndefined();
    expect(filenamesToDelete(current, next)).toEqual([
      'asset-1-hash-a.pmtiles',
    ]);
  });

  it('drops an unlisted asset and leaves listed assets alone', () => {
    const current = {
      'asset-1': file('asset-1', 'hash-a'),
      'asset-2': file('asset-2', 'hash-c'),
    };
    const next = retainListedLayers(current, ['asset-1']);

    expect(next['asset-1']).toEqual(current['asset-1']);
    expect(next['asset-2']).toBeUndefined();
    expect(filenamesToDelete(current, next)).toEqual([
      'asset-2-hash-c.pmtiles',
    ]);
  });
});

describe('unionListedAssetIds', () => {
  it('unions present listings', () => {
    expect(unionListedAssetIds([['a'], ['a', 'b'], []])).toEqual({
      keepIds: ['a', 'b'],
      uncertain: false,
    });
  });

  it('marks the keep-set uncertain when a listing is omitted', () => {
    expect(unionListedAssetIds([['a'], undefined])).toEqual({
      keepIds: ['a'],
      uncertain: true,
    });
  });
});

describe('collectActivatedLayerKeepSet', () => {
  it('uses directory overrides and last-known listings', () => {
    const result = collectActivatedLayerKeepSet(
      [
        {
          projectId: 'survey-a',
          contextualLayers: [{id: 'old-a'}, {id: 'keep'}],
        },
        {projectId: 'survey-b', contextualLayers: [{id: 'b'}]},
      ],
      new Map([['survey-a', ['a', 'keep']]])
    );

    expect(result).toEqual({
      keepIds: ['a', 'keep', 'b'],
      uncertain: false,
    });
  });

  it('is uncertain when an override is an omitted attach', () => {
    const result = collectActivatedLayerKeepSet(
      [{projectId: 'survey-a', contextualLayers: [{id: 'a'}]}],
      new Map([['survey-a', undefined]])
    );

    expect(result.uncertain).toBe(true);
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
