// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {
  DEFAULT_SPATIAL_TOOL_PERFORMANCE,
  gdalConfigArgs,
  gdalWarpPerformanceArgs,
  ogr2ogrGeometryArgs,
  spatialToolProcessEnv,
  tippecanoeVectorArgs,
  vectorIntermediateFilename,
  type SpatialToolPerformance,
} from '../src/spatial/gdalPerformance';

const tuned: SpatialToolPerformance = {
  gdalNumThreads: 'ALL_CPUS',
  gdalCacheMaxMb: 2048,
  gdalWarpMemoryMb: 1024,
  gdalWarpMulti: true,
  tippecanoeMaxThreads: 8,
};

describe('spatial tool performance args', () => {
  it('writes FlatGeobuf and tippecanoe -z 14', () => {
    expect(vectorIntermediateFilename()).toBe('normalized.fgb');
    expect(ogr2ogrGeometryArgs('out.fgb', 'in.gpkg')).toEqual([
      '-f',
      'FlatGeobuf',
      '-nlt',
      'GEOMETRY',
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
    expect(tippecanoeVectorArgs('out.pmtiles', 'out.fgb')).toEqual([
      '-o',
      'out.pmtiles',
      '-z',
      '14',
      '--drop-densest-as-needed',
      '--force',
      '--json-progress',
      '--progress-interval=5',
      '-l',
      'features',
      'out.fgb',
    ]);
  });

  it('passes -progress, warp threads, cache, -multi, and -wm', () => {
    expect(gdalWarpPerformanceArgs(tuned)).toEqual([
      '-progress',
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
      '-progress',
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
