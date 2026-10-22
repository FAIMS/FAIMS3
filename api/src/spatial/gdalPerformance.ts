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
/** Street-scale native tiles so cadastre is not overzoomed from z14. */
export const VECTOR_POLYGON_TILE_MAX_ZOOM = 16;

export type VectorOgrFormat = 'FlatGeobuf' | 'GeoJSONSeq';
export type VectorGeometryFamily = 'point' | 'line' | 'polygon';

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
  /** Set when every source layer is one point / line / polygon family. */
  family?: VectorGeometryFamily;
};

const FGB_GEOMETRY_FAMILY: Record<string, VectorGeometryFamily> = {
  point: 'point',
  multipoint: 'point',
  linestring: 'line',
  multilinestring: 'line',
  linearring: 'line',
  polygon: 'polygon',
  multipolygon: 'polygon',
};

/** Lowercase GDAL geometry type without spaces, 25D, or Z/M suffixes. */
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

/**
 * Single point / line / polygon family when every layer matches.
 * Mixed or unknown types return `undefined` so the caller uses GeoJSONSeq.
 */
function homogeneousGeometryFamily(
  types: string[]
): VectorGeometryFamily | undefined {
  const families = new Set<VectorGeometryFamily>();
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
  const [family] = families;
  return family;
}

/**
 * FlatGeobuf with a concrete type when every source layer is one geometry
 * family. Otherwise GeoJSONSeq so tippecanoe can read mixed collections.
 */
export function vectorIntermediatePlan(info?: unknown): VectorIntermediatePlan {
  const family = homogeneousGeometryFamily(geometryFieldTypes(info));
  if (family) {
    return {
      filename: VECTOR_INTERMEDIATE_FGB,
      format: 'FlatGeobuf',
      nlt: 'PROMOTE_TO_MULTI',
      family,
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

/** gdalwarp thread, cache, and tiled-GeoTIFF creation options. */
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

/**
 * ogr2ogr args for a geometry-only EPSG:4326 intermediate.
 * FlatGeobuf skips `-explodecollections` so MultiPolygon layers stay valid;
 * GeoJSONSeq explodes collections so tippecanoe sees ordinary features.
 */
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

/**
 * Family-specific tippecanoe thinning. Polygons drop (not coalesce) below
 * `--base-zoom` so dense cadastre stays light at z0–z9 without dissolving
 * street blocks. Attributes are stripped, so `--coalesce` would merge every
 * neighbouring parcel. Points space out. Lines and mixed layers drop-densest.
 *
 * tippecanoe 2.78+ exits 100 when `--coalesce-smallest-as-needed` cannot
 * raise its area threshold ("Can't increase feature area threshold
 * further"). That branch does not fall through. `--drop-fraction-as-needed`
 * can always increase; `--extend-zooms-if-still-dropping` covers leftover
 * overflow at the family max zoom.
 */
function tippecanoeThinningArgs(family?: VectorGeometryFamily): string[] {
  if (family === 'polygon') {
    // Drop tiny polygons at low zoom. Do not coalesce: empty attributes
    // would dissolve adjacent parcels at every zoom, including street scale.
    return [
      '--hilbert',
      '--drop-fraction-as-needed',
      '--drop-polygons',
      '--drop-rate=3',
      '--base-zoom=10',
      '--maximum-tile-bytes=80000',
      '--simplification=10',
      '--simplify-only-low-zooms',
      '--extend-zooms-if-still-dropping',
    ];
  }
  if (family === 'point') {
    // Keep full detail only where spacing allows. Guess a drop rate that
    // holds the densest tile under 50k, then cap bytes and feature count.
    return [
      '--drop-densest-as-needed',
      '--drop-rate=g',
      '--maximum-tile-bytes=80000',
      '--maximum-tile-features=5000',
      '--hilbert',
      '--extend-zooms-if-still-dropping',
    ];
  }
  return ['--drop-densest-as-needed', '--extend-zooms-if-still-dropping'];
}

/**
 * MBTiles WebP quality. The MBTiles driver only honours QUALITY (lossy);
 * it does not forward the WEBP driver's LOSSLESS flag. 90 keeps thin
 * collar text readable without PNG-sized tiles.
 */
export const RASTER_WEBP_QUALITY = 90;

/** True when GDAL is opening a GeoPDF (optional-content layers apply). */
export function isPdfPath(filePath: string): boolean {
  return /\.pdf$/i.test(filePath);
}

/**
 * Turn every GeoPDF optional-content group on so collar / surround
 * layers are rasterized, not just the default "Map Layers" group.
 */
export function gdalPdfOpenArgs(sourcePath: string): string[] {
  return isPdfPath(sourcePath) ? ['-oo', 'LAYERS=ALL'] : [];
}

/** MBTiles WebP creation options for raster ingest. */
export function mbtilesWebpCreationArgs(): string[] {
  return ['-co', 'TILE_FORMAT=WEBP', '-co', `QUALITY=${RASTER_WEBP_QUALITY}`];
}

/** Highest zoom tippecanoe is asked to build before extend-zooms. */
export function vectorTileMaxZoom(family?: VectorGeometryFamily): number {
  return family === 'polygon'
    ? VECTOR_POLYGON_TILE_MAX_ZOOM
    : VECTOR_TILE_MAX_ZOOM;
}

/** tippecanoe args: PMTiles out, family-specific thinning, JSON progress every 5s. */
export function tippecanoeVectorArgs(
  pmtilesPath: string,
  inputPath: string,
  plan: VectorIntermediatePlan = vectorIntermediatePlan()
): string[] {
  return [
    '-o',
    pmtilesPath,
    '-z',
    String(vectorTileMaxZoom(plan.family)),
    ...tippecanoeThinningArgs(plan.family),
    '--force',
    '--json-progress',
    '--progress-interval=5',
    '-l',
    'features',
    inputPath,
  ];
}
