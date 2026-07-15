import type {OfflineMapRegion} from '@faims3/data-model';
import {describe, expect, it} from 'vitest';
import type {StoredTileSet} from './TileStore';
import {
  deriveTileSetDownloadStatus,
  formatOfflineMapSizeBytes,
  formatOfflineMapSizeMb,
  offlineMapRegionsEqual,
  tileSetDownloadProgress,
} from './offlineMapRegionUtils';

const region: OfflineMapRegion = {
  type: 'Polygon',
  coordinates: [
    [
      [150.0, -34.0],
      [151.0, -34.0],
      [151.0, -33.0],
      [150.0, -33.0],
      [150.0, -34.0],
    ],
  ],
};

function makeTileSet(overrides: Partial<StoredTileSet> = {}): StoredTileSet {
  return {
    setName: 'test-set',
    extent: [0, 0, 1, 1],
    minZoom: 0,
    maxZoom: 14,
    size: 5_000_000,
    expectedTileCount: 100,
    created: new Date('2024-01-01'),
    tileKeys: [],
    ...overrides,
  };
}

describe('offlineMapRegionsEqual', () => {
  it('matches regions with tiny floating-point differences', () => {
    const almostSame: OfflineMapRegion = {
      type: 'Polygon',
      coordinates: [
        [
          [150.0000000001, -34.0],
          [151.0, -34.0],
          [151.0, -33.0],
          [150.0, -33.0],
          [150.0000000001, -34.0],
        ],
      ],
    };

    expect(offlineMapRegionsEqual(region, almostSame)).toBe(true);
  });
});

describe('formatOfflineMapSizeMb', () => {
  it('formats sub-gigabyte sizes in megabytes', () => {
    expect(formatOfflineMapSizeMb(42.5)).toBe('42.50 MB');
  });

  it('formats large sizes in gigabytes', () => {
    expect(formatOfflineMapSizeMb(2048)).toBe('2.00 GB');
  });
});

describe('formatOfflineMapSizeBytes', () => {
  it('converts bytes to the shared megabyte display format', () => {
    expect(formatOfflineMapSizeBytes(42.5 * 1024 * 1024)).toBe('42.50 MB');
  });
});

describe('tileSetDownloadProgress', () => {
  it('returns null when expected tile count is unknown', () => {
    expect(tileSetDownloadProgress(makeTileSet({expectedTileCount: 0}))).toBe(
      null
    );
  });

  it('returns the fraction of tiles downloaded so far', () => {
    expect(
      tileSetDownloadProgress(
        makeTileSet({expectedTileCount: 10, tileKeys: Array.from({length: 3})})
      )
    ).toBe(0.3);
  });
});

describe('deriveTileSetDownloadStatus', () => {
  it('reports not downloaded when no tile set exists', () => {
    expect(deriveTileSetDownloadStatus(undefined)).toEqual({
      state: 'not_downloaded',
    });
  });

  it('reports downloading while tiles remain', () => {
    expect(
      deriveTileSetDownloadStatus(
        makeTileSet({expectedTileCount: 10, tileKeys: Array.from({length: 4})})
      )
    ).toEqual({state: 'downloading', progress: 0.4});
  });

  it('reports downloaded when all expected tiles are present', () => {
    expect(
      deriveTileSetDownloadStatus(
        makeTileSet({
          expectedTileCount: 10,
          tileKeys: Array.from({length: 10}),
          size: 1_500_000,
        })
      )
    ).toEqual({state: 'downloaded', sizeBytes: 1_500_000});
  });
});
