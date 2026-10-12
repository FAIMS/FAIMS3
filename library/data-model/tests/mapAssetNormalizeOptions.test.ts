// SPDX-License-Identifier: Apache-2.0
import {
  DEFAULT_MAP_ASSET_NORMALIZE_OPTIONS,
  DEFAULT_MAP_ASSET_QUALITY,
  estimateNormalizedMapAsset,
  mapAssetKindFromFilename,
  mapAssetNormalizeOptionsFromQuality,
  resolveMapAssetNormalizeOptions,
} from '../src/data_storage/mapAssetsDB/normalizeOptions';

describe('mapAssetNormalizeOptionsFromQuality', () => {
  it('matches the historic defaults at quality 50', () => {
    expect(
      mapAssetNormalizeOptionsFromQuality(DEFAULT_MAP_ASSET_QUALITY)
    ).toEqual(DEFAULT_MAP_ASSET_NORMALIZE_OPTIONS);
  });

  it('uses a smaller raster and tighter simplify budget at quality 0', () => {
    const low = mapAssetNormalizeOptionsFromQuality(0);
    expect(low.maxRasterEdgePx).toBeLessThan(
      DEFAULT_MAP_ASSET_NORMALIZE_OPTIONS.maxRasterEdgePx
    );
    expect(low.vectorSimplifyBytes).toBeLessThan(
      DEFAULT_MAP_ASSET_NORMALIZE_OPTIONS.vectorSimplifyBytes
    );
    expect(low.vectorSimplifyTolerances[0]).toBeGreaterThan(
      DEFAULT_MAP_ASSET_NORMALIZE_OPTIONS.vectorSimplifyTolerances[0]
    );
  });

  it('uses a larger raster and looser simplify budget at quality 100', () => {
    const high = mapAssetNormalizeOptionsFromQuality(100);
    expect(high.maxRasterEdgePx).toBeGreaterThan(
      DEFAULT_MAP_ASSET_NORMALIZE_OPTIONS.maxRasterEdgePx
    );
    expect(high.vectorSimplifyBytes).toBeGreaterThan(
      DEFAULT_MAP_ASSET_NORMALIZE_OPTIONS.vectorSimplifyBytes
    );
  });
});

describe('resolveMapAssetNormalizeOptions', () => {
  it('defaults to quality 50 when nothing is passed', () => {
    const resolved = resolveMapAssetNormalizeOptions();
    expect(resolved.quality).toBe(50);
    expect(resolved.options).toEqual(DEFAULT_MAP_ASSET_NORMALIZE_OPTIONS);
  });

  it('lets explicit options override the quality mapping', () => {
    const resolved = resolveMapAssetNormalizeOptions({
      quality: 0,
      options: {maxRasterEdgePx: 2048},
    });
    expect(resolved.options.maxRasterEdgePx).toBe(2048);
    expect(resolved.options.vectorSimplifyBytes).toBe(
      mapAssetNormalizeOptionsFromQuality(0).vectorSimplifyBytes
    );
  });
});

describe('estimateNormalizedMapAsset', () => {
  it('shrinks a large raster when quality lowers the pixel cap', () => {
    const high = estimateNormalizedMapAsset({
      quality: 100,
      source: {
        filename: 'scene.tif',
        byteSize: 80 * 1024 * 1024,
        widthPx: 12000,
        heightPx: 8000,
      },
    });
    const low = estimateNormalizedMapAsset({
      quality: 0,
      source: {
        filename: 'scene.tif',
        byteSize: 80 * 1024 * 1024,
        widthPx: 12000,
        heightPx: 8000,
      },
    });
    expect(high.kind).toBe('image');
    expect(low.estimatedByteSize).toBeLessThan(high.estimatedByteSize);
    expect(low.options.maxRasterEdgePx).toBeLessThan(
      high.options.maxRasterEdgePx
    );
  });

  it('simplifies a large GeoJSON more aggressively at low quality', () => {
    const source = {
      filename: 'fires.geojson',
      byteSize: 24 * 1024 * 1024,
    };
    const high = estimateNormalizedMapAsset({quality: 100, source});
    const low = estimateNormalizedMapAsset({quality: 0, source});
    expect(high.kind).toBe('geojson');
    expect(low.estimatedByteSize).toBeLessThan(high.estimatedByteSize);
  });

  it('infers kind from the filename', () => {
    expect(mapAssetKindFromFilename('area.gpkg')).toBe('geojson');
    expect(mapAssetKindFromFilename('scan.PDF')).toBe('image');
  });
});
