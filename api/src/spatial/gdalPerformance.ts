// SPDX-License-Identifier: Apache-2.0
/**
 * GDAL / tippecanoe thread and memory knobs for map-layer ingest.
 *
 * Conservative defaults fit the 1 vCPU / 2 GiB worker. Raise
 * `gdalCacheMaxMb` and `gdalWarpMemoryMb` on larger Fargate tasks.
 * `gdalNumThreads: ALL_CPUS` already scales with the task vCPU count.
 */

export const DEFAULT_GDAL_NUM_THREADS = 'ALL_CPUS';
export const DEFAULT_GDAL_CACHE_MAX_MB = 256;
export const DEFAULT_GDAL_WARP_MEMORY_MB = 256;
export const DEFAULT_GDAL_WARP_MULTI = true;
export const VECTOR_INTERMEDIATE_FILENAME = 'normalized.fgb';
export const VECTOR_TILE_MAX_ZOOM = 14;

export type SpatialToolPerformance = {
  /** `ALL_CPUS` or a positive integer as a string. */
  gdalNumThreads: string;
  /** Raster block cache in megabytes (`GDAL_CACHEMAX`). */
  gdalCacheMaxMb: number;
  /** `gdalwarp -wm` working buffer in megabytes (shared across warp threads). */
  gdalWarpMemoryMb: number;
  /** `gdalwarp -multi` — overlap I/O with compute. */
  gdalWarpMulti: boolean;
  /** Cap tippecanoe threads. Unset = all CPUs. */
  tippecanoeMaxThreads?: number;
};

export const DEFAULT_SPATIAL_TOOL_PERFORMANCE: SpatialToolPerformance = {
  gdalNumThreads: DEFAULT_GDAL_NUM_THREADS,
  gdalCacheMaxMb: DEFAULT_GDAL_CACHE_MAX_MB,
  gdalWarpMemoryMb: DEFAULT_GDAL_WARP_MEMORY_MB,
  gdalWarpMulti: DEFAULT_GDAL_WARP_MULTI,
};

/** Intermediate vector filename. FlatGeobuf for tippecanoe's parallel FGB path. */
export function vectorIntermediateFilename(): string {
  return VECTOR_INTERMEDIATE_FILENAME;
}

/** Child-process env so GDAL and tippecanoe see the same knobs as CLI flags. */
export function spatialToolProcessEnv(
  perf: SpatialToolPerformance,
  base: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...base,
    GDAL_NUM_THREADS: perf.gdalNumThreads,
    GDAL_CACHEMAX: String(perf.gdalCacheMaxMb),
  };
  if (perf.tippecanoeMaxThreads !== undefined) {
    env.TIPPECANOE_MAX_THREADS = String(perf.tippecanoeMaxThreads);
  } else {
    delete env.TIPPECANOE_MAX_THREADS;
  }
  return env;
}

/** `--config` pairs applied to raster GDAL commands. */
export function gdalConfigArgs(perf: SpatialToolPerformance): string[] {
  return [
    '--config',
    'GDAL_NUM_THREADS',
    perf.gdalNumThreads,
    '--config',
    'GDAL_CACHEMAX',
    String(perf.gdalCacheMaxMb),
  ];
}

export function gdalWarpPerformanceArgs(
  perf: SpatialToolPerformance
): string[] {
  return [
    ...gdalConfigArgs(perf),
    ...(perf.gdalWarpMulti ? ['-multi'] : []),
    '-wm',
    String(perf.gdalWarpMemoryMb),
    '-wo',
    `NUM_THREADS=${perf.gdalNumThreads}`,
    '-co',
    'TILED=YES',
  ];
}

export function ogr2ogrGeometryArgs(
  outputPath: string,
  gdalSource: string
): string[] {
  return [
    '-f',
    'FlatGeobuf',
    '-nlt',
    'GEOMETRY',
    '-lco',
    'SPATIAL_INDEX=NO',
    '-t_srs',
    'EPSG:4326',
    // One output layer. -nln appends every source layer (KML folders,
    // multi-layer GeoPackages) into that layer.
    '-nln',
    'features',
    // Devices draw geometry. Style lives on the asset.
    '-select',
    '',
    outputPath,
    gdalSource,
  ];
}

export function tippecanoeVectorArgs(
  pmtilesPath: string,
  fgbPath: string
): string[] {
  return [
    '-o',
    pmtilesPath,
    '-z',
    String(VECTOR_TILE_MAX_ZOOM),
    '--drop-densest-as-needed',
    '--force',
    '--json-progress',
    '--progress-interval=5',
    '-l',
    'features',
    fgbPath,
  ];
}
