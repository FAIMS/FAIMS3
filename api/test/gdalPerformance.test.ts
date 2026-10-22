// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {
  DEFAULT_SPATIAL_TOOL_PERFORMANCE,
  gdalConfigArgs,
  gdalWarpPerformanceArgs,
  geometryFieldTypes,
  ogr2ogrGeometryArgs,
  spatialToolProcessEnv,
  tippecanoeVectorArgs,
  vectorIntermediateFilename,
  vectorIntermediatePlan,
  type SpatialToolPerformance,
} from '../src/spatial/gdalPerformance';

function ogrInfoForTypes(...types: string[]) {
  return {
    layers: types.map(type => ({geometryFields: [{type}]})),
  };
}

const tuned: SpatialToolPerformance = {
  gdalNumThreads: 'ALL_CPUS',
  gdalCacheMaxMb: 2048,
  gdalWarpMemoryMb: 1024,
  gdalWarpMulti: true,
  tippecanoeMaxThreads: 8,
};

describe('spatial tool performance args', () => {
  it('writes FlatGeobuf for a homogeneous polygon layer', () => {
    const plan = vectorIntermediatePlan(ogrInfoForTypes('Polygon'));
    expect(plan).toEqual({
      filename: 'normalized.fgb',
      format: 'FlatGeobuf',
      nlt: 'PROMOTE_TO_MULTI',
      family: 'polygon',
    });
    expect(vectorIntermediateFilename(plan)).toBe('normalized.fgb');
    expect(ogr2ogrGeometryArgs('out.fgb', 'in.gpkg', plan)).toEqual([
      '-f',
      'FlatGeobuf',
      '-nlt',
      'PROMOTE_TO_MULTI',
      '-lco',
      'SPATIAL_INDEX=NO',
      '-t_srs',
      'EPSG:4326',
      '-nln',
      'features',
      '-select',
      '',
      'out.fgb',
      'in.gpkg',
    ]);
    expect(ogr2ogrGeometryArgs('out.fgb', 'in.gpkg', plan)).not.toContain(
      '-explodecollections'
    );
    expect(vectorIntermediatePlan(ogrInfoForTypes('MultiPolygon'))).toEqual({
      filename: 'normalized.fgb',
      format: 'FlatGeobuf',
      nlt: 'PROMOTE_TO_MULTI',
      family: 'polygon',
    });
    expect(tippecanoeVectorArgs('out.pmtiles', 'out.fgb', plan)).toEqual([
      '-o',
      'out.pmtiles',
      '-z',
      '14',
      '--coalesce',
      '--reorder',
      '--hilbert',
      '--drop-fraction-as-needed',
      '--drop-polygons',
      '--drop-rate=3',
      '--base-zoom=10',
      '--maximum-tile-bytes=80000',
      '--simplification=10',
      '--simplify-only-low-zooms',
      '--extend-zooms-if-still-dropping',
      '--force',
      '--json-progress',
      '--progress-interval=5',
      '-l',
      'features',
      'out.fgb',
    ]);
    expect(tippecanoeVectorArgs('out.pmtiles', 'out.fgb', plan)).not.toContain(
      '--coalesce-smallest-as-needed'
    );
  });

  it('thins dense point layers by spacing, not coalesce', () => {
    const plan = vectorIntermediatePlan(ogrInfoForTypes('Point'));
    expect(plan).toEqual({
      filename: 'normalized.fgb',
      format: 'FlatGeobuf',
      nlt: 'PROMOTE_TO_MULTI',
      family: 'point',
    });
    expect(vectorIntermediatePlan(ogrInfoForTypes('Multi Point'))).toEqual({
      filename: 'normalized.fgb',
      format: 'FlatGeobuf',
      nlt: 'PROMOTE_TO_MULTI',
      family: 'point',
    });
    expect(tippecanoeVectorArgs('out.pmtiles', 'out.fgb', plan)).toEqual([
      '-o',
      'out.pmtiles',
      '-z',
      '14',
      '--drop-densest-as-needed',
      '--drop-rate=g',
      '--maximum-tile-bytes=80000',
      '--maximum-tile-features=5000',
      '--hilbert',
      '--extend-zooms-if-still-dropping',
      '--force',
      '--json-progress',
      '--progress-interval=5',
      '-l',
      'features',
      'out.fgb',
    ]);
  });

  it('uses drop-densest for line and mixed layers', () => {
    const line = vectorIntermediatePlan(ogrInfoForTypes('Line String'));
    expect(line.family).toBe('line');
    expect(tippecanoeVectorArgs('out.pmtiles', 'out.fgb', line)).toEqual([
      '-o',
      'out.pmtiles',
      '-z',
      '14',
      '--drop-densest-as-needed',
      '--extend-zooms-if-still-dropping',
      '--force',
      '--json-progress',
      '--progress-interval=5',
      '-l',
      'features',
      'out.fgb',
    ]);
    const mixed = vectorIntermediatePlan(
      ogrInfoForTypes('Polygon', 'Line String')
    );
    expect(mixed.family).toBeUndefined();
    expect(tippecanoeVectorArgs('out.pmtiles', 'out.geojson', mixed)).toContain(
      '--drop-densest-as-needed'
    );
    expect(tippecanoeVectorArgs('out.pmtiles', 'out.geojson', mixed)).toContain(
      '--extend-zooms-if-still-dropping'
    );
    expect(
      tippecanoeVectorArgs('out.pmtiles', 'out.geojson', mixed)
    ).not.toContain('--drop-polygons');
  });

  it('writes GeoJSONSeq when ogrinfo reports mixed or unknown geometry', () => {
    expect(geometryFieldTypes(ogrInfoForTypes('Geometry'))).toEqual([
      'Geometry',
    ]);
    const mixed = vectorIntermediatePlan(
      ogrInfoForTypes('Polygon', 'Line String')
    );
    expect(mixed.format).toBe('GeoJSONSeq');
    expect(vectorIntermediatePlan(ogrInfoForTypes('Geometry'))).toEqual({
      filename: 'normalized.geojson',
      format: 'GeoJSONSeq',
      nlt: 'GEOMETRY',
    });
    expect(
      vectorIntermediatePlan(ogrInfoForTypes('Geometry Collection'))
    ).toEqual({
      filename: 'normalized.geojson',
      format: 'GeoJSONSeq',
      nlt: 'GEOMETRY',
    });
    expect(
      vectorIntermediatePlan(ogrInfoForTypes('Polygon', 'Multi Polygon'))
    ).toEqual({
      filename: 'normalized.fgb',
      format: 'FlatGeobuf',
      nlt: 'PROMOTE_TO_MULTI',
      family: 'polygon',
    });
    const plan = vectorIntermediatePlan(ogrInfoForTypes('Geometry'));
    expect(ogr2ogrGeometryArgs('out.geojson', 'in.geojson', plan)).toEqual([
      '-f',
      'GeoJSONSeq',
      '-nlt',
      'GEOMETRY',
      '-explodecollections',
      '-lco',
      'RS=YES',
      '-t_srs',
      'EPSG:4326',
      '-nln',
      'features',
      '-select',
      '',
      'out.geojson',
      'in.geojson',
    ]);
  });

  it('passes warp threads, cache, -multi, and -wm', () => {
    expect(gdalWarpPerformanceArgs(tuned)).toEqual([
      '--config',
      'GDAL_NUM_THREADS',
      'ALL_CPUS',
      '--config',
      'GDAL_CACHEMAX',
      '2048',
      '-multi',
      '-wm',
      '1024',
      '-wo',
      'NUM_THREADS=ALL_CPUS',
      '-co',
      'TILED=YES',
    ]);
    expect(gdalConfigArgs(tuned)).toEqual([
      '--config',
      'GDAL_NUM_THREADS',
      'ALL_CPUS',
      '--config',
      'GDAL_CACHEMAX',
      '2048',
    ]);
  });

  it('omits -multi when disabled', () => {
    const args = gdalWarpPerformanceArgs({...tuned, gdalWarpMulti: false});
    expect(args).not.toContain('-multi');
  });

  it('sets GDAL env and a tippecanoe thread cap', () => {
    const env = spatialToolProcessEnv(tuned, {PATH: '/usr/bin'});
    expect(env.GDAL_NUM_THREADS).toBe('ALL_CPUS');
    expect(env.GDAL_CACHEMAX).toBe('2048');
    expect(env.TIPPECANOE_MAX_THREADS).toBe('8');
  });

  it('clears an inherited tippecanoe cap when unset', () => {
    const env = spatialToolProcessEnv(DEFAULT_SPATIAL_TOOL_PERFORMANCE, {
      TIPPECANOE_MAX_THREADS: '99',
    });
    expect(env.TIPPECANOE_MAX_THREADS).toBeUndefined();
  });
});
