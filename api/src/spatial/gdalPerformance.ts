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
export const VECTOR_INTERMEDIATE_FGB = 'normalized.fgb';
export const VECTOR_INTERMEDIATE_GEOJSONSEQ = 'normalized.geojson';
export const VECTOR_TILE_MAX_ZOOM = 14;

export type VectorOgrFormat = 'FlatGeobuf' | 'GeoJSONSeq';

/**
 * How ogr2ogr writes the geometry-only intermediate that tippecanoe reads.
 * Tippecanoe's FlatGeobuf reader rejects header type 0 (Unknown) for
 * MultiLineString and GeometryCollection, so mixed / unknown layers use
 * GeoJSONSeq with RFC 8142 RS (still parallel).
 */
export type VectorIntermediatePlan = {
  filename: string;
  format: VectorOgrFormat;
  nlt: string;
};

const FGB_GEOMETRY_FAMILY: Record<string, 'point' | 'line' | 'polygon'> = {
  point: 'point',
  multipoint: 'point',
  linestring: 'line',
  multilinestring: 'line',
  linearring: 'line',
  polygon: 'polygon',
  multipolygon: 'polygon',
};

function canonicalGeometryType(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\s_-]/g, '')
    .replace(/25d$/, '')
    .replace(/[zm]+$/, '');
}

/** Layer geometry types from `ogrinfo -json` (`geometryFields[].type`). */
export function geometryFieldTypes(info: unknown): string[] {
  if (!info || typeof info !== 'object') {
    return [];
  }
  const layers = (info as {layers?: unknown}).layers;
  if (!Array.isArray(layers)) {
    return [];
  }
  const types: string[] = [];
  for (const layer of layers) {
    if (!layer || typeof layer !== 'object') {
      continue;
    }
    const fields = (layer as {geometryFields?: unknown}).geometryFields;
    if (!Array.isArray(fields)) {
      continue;
    }
    for (const field of fields) {
      if (!field || typeof field !== 'object') {
        continue;
      }
      const type = (field as {type?: unknown}).type;
      if (typeof type === 'string' && type.trim()) {
        types.push(type);
      }
    }
  }
  return types;
}

function concreteFgbNlt(types: string[]): string | undefined {
  const families = new Set<'point' | 'line' | 'polygon'>();
  for (const raw of types) {
    const canonical = canonicalGeometryType(raw);
    if (
      canonical === '' ||
      canonical === 'none' ||
      canonical === 'geometry' ||
      canonical === 'geometrycollection' ||
      canonical.startsWith('unknown')
    ) {
      return undefined;
    }
    const family = FGB_GEOMETRY_FAMILY[canonical];
    if (!family) {
      return undefined;
    }
    families.add(family);
  }
  if (families.size !== 1) {
    return undefined;
  }
  return 'PROMOTE_TO_MULTI';
}

/**
 * FlatGeobuf with a concrete type when every source layer is one geometry
 * family. Otherwise GeoJSONSeq so tippecanoe can read mixed collections.
 */
export function vectorIntermediatePlan(info?: unknown): VectorIntermediatePlan {
  const nlt = concreteFgbNlt(geometryFieldTypes(info));
  if (nlt) {
    return {
      filename: VECTOR_INTERMEDIATE_FGB,
      format: 'FlatGeobuf',
      nlt,
    };
  }
  return {
    filename: VECTOR_INTERMEDIATE_GEOJSONSEQ,
    format: 'GeoJSONSeq',
    nlt: 'GEOMETRY',
  };
}

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

/** Intermediate vector filename for the chosen ogr2ogr plan. */
export function vectorIntermediateFilename(
  plan: VectorIntermediatePlan = vectorIntermediatePlan()
): string {
  return plan.filename;
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
  gdalSource: string,
  plan: VectorIntermediatePlan = vectorIntermediatePlan()
): string[] {
  const flatGeobuf = plan.format === 'FlatGeobuf';
  const layerCreation = flatGeobuf
    ? ['-lco', 'SPATIAL_INDEX=NO']
    : ['-lco', 'RS=YES'];
  // -explodecollections plus -nlt PROMOTE_TO_MULTI makes FlatGeobuf create a
  // Polygon layer then write MultiPolygon features (ICreateFeature mismatch).
  // File Geodatabase polygon classes are often MultiPolygon. Keep explode on
  // GeoJSONSeq so GeometryCollection members become ordinary features.
  const explodeCollections = flatGeobuf ? [] : ['-explodecollections'];
  return [
    '-f',
    plan.format,
    '-nlt',
    plan.nlt,
    ...explodeCollections,
    ...layerCreation,
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
  inputPath: string
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
    inputPath,
  ];
}
