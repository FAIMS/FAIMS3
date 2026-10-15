// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {
  DEFAULT_SPATIAL_TOOL_PERFORMANCE,
  gdalConfigArgs,
  gdalWarpPerformanceArgs,
  ogr2ogrGeometryArgs,
  spatialToolProcessEnv,
  tippecanoePerformanceArgs,
  vectorIntermediateFilename,
  type SpatialToolPerformance,
} from '../src/spatial/gdalPerformance';

const tuned: SpatialToolPerformance = {
  gdalNumThreads: 'ALL_CPUS',
  gdalCacheMaxMb: 2048,
  gdalWarpMemoryMb: 1024,
  gdalWarpMulti: true,
  tippecanoeMaxThreads: 8,
  tippecanoeReadParallel: true,
};

describe('spatial tool performance args', () => {
  it('writes GeoJSONSeq and --read-parallel when parallel parse is on', () => {
    expect(vectorIntermediateFilename(tuned)).toBe('normalized.geojsons');
    expect(ogr2ogrGeometryArgs(tuned, 'out.geojsons', 'in.gpkg')).toEqual([
      '-f',
      'GeoJSONSeq',
      '-t_srs',
      'EPSG:4326',
      '-nln',
      'features',
      '-select',
      '',
      'out.geojsons',
      'in.gpkg',
    ]);
    expect(tippecanoePerformanceArgs(tuned)).toEqual(['--read-parallel']);
  });

  it('keeps RFC7946 FeatureCollection when parallel parse is off', () => {
    const serial: SpatialToolPerformance = {
      ...DEFAULT_SPATIAL_TOOL_PERFORMANCE,
      tippecanoeReadParallel: false,
    };
    expect(vectorIntermediateFilename(serial)).toBe('normalized.geojson');
    expect(ogr2ogrGeometryArgs(serial, 'out.geojson', 'in.gpkg')[1]).toBe(
      'GeoJSON'
    );
    expect(tippecanoePerformanceArgs(serial)).toEqual([]);
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
