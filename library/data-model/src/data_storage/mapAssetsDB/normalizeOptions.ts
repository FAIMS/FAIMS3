// SPDX-License-Identifier: Apache-2.0
/**
 * Device-payload settings for a map-layer upload.
 *
 * Quality 50 is the historic default (4096 px rasters, simplify vectors
 * above 5 MB). Quality 100 keeps the source image 1:1, up to
 * {@link MAP_ASSET_QUALITY_HIGH_EDGE_PX}. The Control Centre slider sends
 * `quality`; callers may also pass explicit `options` to override fields.
 */

import {z} from 'zod';
import {INPUT_LIMITS} from '../../inputLimits';
import type {MapAssetKind} from './types';

const KindSchema = z.enum(['geojson', 'image']);

export const MAP_ASSET_QUALITY_MIN = 0;
export const MAP_ASSET_QUALITY_MAX = 100;
/** Middle of the slider — current production behaviour. */
export const DEFAULT_MAP_ASSET_QUALITY = 50;

export const MapAssetQualitySchema = z
  .number()
  .min(MAP_ASSET_QUALITY_MIN)
  .max(MAP_ASSET_QUALITY_MAX);
export type MapAssetQuality = z.infer<typeof MapAssetQualitySchema>;

/**
 * Longest edge kept at quality 100. A smaller source is not enlarged.
 * Above this, even the top setting downsamples.
 */
export const MAP_ASSET_QUALITY_HIGH_EDGE_PX = 32768;

export const MapAssetNormalizeOptionsSchema = z.object({
  /** Longest edge of the device PNG, in pixels. */
  maxRasterEdgePx: z
    .number()
    .int()
    .min(256)
    .max(MAP_ASSET_QUALITY_HIGH_EDGE_PX),
  /** GeoJSON larger than this is re-exported with ogr2ogr -simplify. */
  vectorSimplifyBytes: z.number().int().nonnegative(),
  /**
   * Two increasing tolerances in degrees. Used only when the GeoJSON
   * is still over `vectorSimplifyBytes` after the previous pass.
   */
  vectorSimplifyTolerances: z.tuple([
    z.number().nonnegative(),
    z.number().nonnegative(),
  ]),
});
export type MapAssetNormalizeOptions = z.infer<
  typeof MapAssetNormalizeOptionsSchema
>;

export const MapAssetNormalizeOptionsInputSchema =
  MapAssetNormalizeOptionsSchema.partial();
export type MapAssetNormalizeOptionsInput = z.infer<
  typeof MapAssetNormalizeOptionsInputSchema
>;

/** Historic hardcoded values — quality 50. */
export const DEFAULT_MAP_ASSET_NORMALIZE_OPTIONS: MapAssetNormalizeOptions = {
  maxRasterEdgePx: 4096,
  vectorSimplifyBytes: 5 * 1024 * 1024,
  vectorSimplifyTolerances: [0.00005, 0.0002],
};

const QUALITY_LOW: MapAssetNormalizeOptions = {
  maxRasterEdgePx: 1024,
  vectorSimplifyBytes: 1 * 1024 * 1024,
  vectorSimplifyTolerances: [0.0004, 0.0016],
};

const QUALITY_HIGH: MapAssetNormalizeOptions = {
  maxRasterEdgePx: MAP_ASSET_QUALITY_HIGH_EDGE_PX,
  vectorSimplifyBytes: 50 * 1024 * 1024,
  vectorSimplifyTolerances: [0.00001, 0.00004],
};

function clampQuality(quality: number): number {
  return Math.min(
    MAP_ASSET_QUALITY_MAX,
    Math.max(MAP_ASSET_QUALITY_MIN, quality)
  );
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function interpolateOptions(
  from: MapAssetNormalizeOptions,
  to: MapAssetNormalizeOptions,
  t: number
): MapAssetNormalizeOptions {
  return {
    maxRasterEdgePx:
      Math.round(lerp(from.maxRasterEdgePx, to.maxRasterEdgePx, t) / 64) * 64,
    vectorSimplifyBytes: Math.round(
      lerp(from.vectorSimplifyBytes, to.vectorSimplifyBytes, t)
    ),
    vectorSimplifyTolerances: [
      lerp(from.vectorSimplifyTolerances[0], to.vectorSimplifyTolerances[0], t),
      lerp(from.vectorSimplifyTolerances[1], to.vectorSimplifyTolerances[1], t),
    ],
  };
}

/** Map a 0–100 quality value onto raster/vector normalize options. */
export function mapAssetNormalizeOptionsFromQuality(
  quality: number
): MapAssetNormalizeOptions {
  const q = clampQuality(quality);
  if (q === DEFAULT_MAP_ASSET_QUALITY) {
    return DEFAULT_MAP_ASSET_NORMALIZE_OPTIONS;
  }
  if (q < DEFAULT_MAP_ASSET_QUALITY) {
    return interpolateOptions(
      QUALITY_LOW,
      DEFAULT_MAP_ASSET_NORMALIZE_OPTIONS,
      q / DEFAULT_MAP_ASSET_QUALITY
    );
  }
  return interpolateOptions(
    DEFAULT_MAP_ASSET_NORMALIZE_OPTIONS,
    QUALITY_HIGH,
    (q - DEFAULT_MAP_ASSET_QUALITY) / DEFAULT_MAP_ASSET_QUALITY
  );
}

export function resolveMapAssetNormalizeOptions(input?: {
  quality?: number;
  options?: MapAssetNormalizeOptionsInput;
}): {quality: number; options: MapAssetNormalizeOptions} {
  const quality = MapAssetQualitySchema.parse(
    input?.quality ?? DEFAULT_MAP_ASSET_QUALITY
  );
  const fromQuality = mapAssetNormalizeOptionsFromQuality(quality);
  const overrides = input?.options ?? {};
  return {
    quality,
    options: MapAssetNormalizeOptionsSchema.parse({
      maxRasterEdgePx: overrides.maxRasterEdgePx ?? fromQuality.maxRasterEdgePx,
      vectorSimplifyBytes:
        overrides.vectorSimplifyBytes ?? fromQuality.vectorSimplifyBytes,
      vectorSimplifyTolerances:
        overrides.vectorSimplifyTolerances ??
        fromQuality.vectorSimplifyTolerances,
    }),
  };
}

const VECTOR_EXTENSIONS = new Set([
  '.geojson',
  '.json',
  '.gpkg',
  '.kml',
  '.zip',
]);
const RASTER_EXTENSIONS = new Set([
  '.tif',
  '.tiff',
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
]);

function extensionOf(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  const dot = base.lastIndexOf('.');
  return dot === -1 ? '' : base.slice(dot).toLowerCase();
}

/**
 * Formats accepted as a map-layer primary. Keep UI copy and API errors
 * aligned with this phrase.
 */
export const MAP_ASSET_PRIMARY_FORMATS =
  'a GeoJSON, GeoPackage, zipped shapefile or File Geodatabase, KML, GeoTIFF, georeferenced PDF, or a PNG/JPEG';

/** Device kind the uploader will produce, or undefined if the file is not a primary. */
export function mapAssetKindFromFilename(
  filename: string
): MapAssetKind | undefined {
  const ext = extensionOf(filename);
  if (VECTOR_EXTENSIONS.has(ext)) {
    return 'geojson';
  }
  if (RASTER_EXTENSIONS.has(ext)) {
    return 'image';
  }
  return undefined;
}

export const MapAssetEstimateSourceSchema = z.object({
  filename: z.string().min(1).max(INPUT_LIMITS.SHORT_TEXT_MAX_LENGTH),
  byteSize: z.number().nonnegative(),
  kind: KindSchema.optional(),
  widthPx: z.number().int().positive().optional(),
  heightPx: z.number().int().positive().optional(),
});
export type MapAssetEstimateSource = z.infer<
  typeof MapAssetEstimateSourceSchema
>;

export const PostMapAssetEstimateInputSchema = z.object({
  source: MapAssetEstimateSourceSchema,
  quality: MapAssetQualitySchema.optional(),
  options: MapAssetNormalizeOptionsInputSchema.optional(),
});
export type PostMapAssetEstimateInput = z.infer<
  typeof PostMapAssetEstimateInputSchema
>;

export const PostMapAssetEstimateResponseSchema = z.object({
  kind: KindSchema,
  quality: MapAssetQualitySchema,
  options: MapAssetNormalizeOptionsSchema,
  estimatedByteSize: z.number().nonnegative(),
  originalByteSize: z.number().nonnegative(),
  summary: z.string().min(1),
});
export type PostMapAssetEstimateResponse = z.infer<
  typeof PostMapAssetEstimateResponseSchema
>;

function geojsonFactor(filename: string): number {
  switch (extensionOf(filename)) {
    case '.gpkg':
      return 2.2;
    case '.zip':
      // File GDB is already binary; shapefile zip expands more as GeoJSON.
      return filename.toLowerCase().endsWith('.gdb.zip') ? 2.2 : 2.8;
    case '.kml':
      return 0.75;
    default:
      return 1;
  }
}

/** How much of the GeoJSON remains after -simplify at this tolerance. */
function simplifyKeepFraction(tolerance: number): number {
  if (tolerance <= 0) {
    return 1;
  }
  return Math.min(0.95, Math.max(0.05, 0.15 / (tolerance * 2000 + 0.15)));
}

function estimateVectorBytes(
  source: MapAssetEstimateSource,
  options: MapAssetNormalizeOptions
): number {
  let bytes = Math.max(1, source.byteSize * geojsonFactor(source.filename));
  if (bytes <= options.vectorSimplifyBytes) {
    return Math.round(bytes);
  }
  const afterFirst =
    bytes * simplifyKeepFraction(options.vectorSimplifyTolerances[0]);
  if (afterFirst <= options.vectorSimplifyBytes) {
    return Math.round(afterFirst);
  }
  return Math.round(
    bytes * simplifyKeepFraction(options.vectorSimplifyTolerances[1])
  );
}

const RASTER_PNG_BYTES_PER_PIXEL = 1.6;

function estimateRasterBytes(
  source: MapAssetEstimateSource,
  options: MapAssetNormalizeOptions,
  quality: number
): number {
  if (source.widthPx && source.heightPx) {
    const scale = rasterScale(source.widthPx, source.heightPx, options);
    const outW = Math.max(1, Math.round(source.widthPx * scale));
    const outH = Math.max(1, Math.round(source.heightPx * scale));
    return Math.round(outW * outH * RASTER_PNG_BYTES_PER_PIXEL);
  }
  // No pixel size yet. Quality 100 keeps the upload (1:1). Quality 50
  // keeps the historic quarter-size guess, and lower settings shrink
  // with the square of the edge cap.
  const keep =
    quality >= MAP_ASSET_QUALITY_MAX
      ? 1
      : quality <= DEFAULT_MAP_ASSET_QUALITY
        ? 0.25 *
          (options.maxRasterEdgePx /
            DEFAULT_MAP_ASSET_NORMALIZE_OPTIONS.maxRasterEdgePx) **
            2
        : 0.25 +
          (1 - 0.25) *
            ((quality - DEFAULT_MAP_ASSET_QUALITY) /
              (MAP_ASSET_QUALITY_MAX - DEFAULT_MAP_ASSET_QUALITY));
  const fromFile = Math.max(source.byteSize * keep, 64 * 1024);
  const pixelCap =
    options.maxRasterEdgePx *
    options.maxRasterEdgePx *
    RASTER_PNG_BYTES_PER_PIXEL;
  return Math.round(Math.min(pixelCap, fromFile));
}

function rasterScale(
  widthPx: number,
  heightPx: number,
  options: MapAssetNormalizeOptions
): number {
  const longEdge = Math.max(widthPx, heightPx);
  return Math.min(1, options.maxRasterEdgePx / longEdge);
}

function imageSummary(
  source: MapAssetEstimateSource,
  options: MapAssetNormalizeOptions,
  estimatedByteSize: number
): string {
  const size = formatBytes(estimatedByteSize);
  if (source.widthPx && source.heightPx) {
    const longEdge = Math.max(source.widthPx, source.heightPx);
    const scale = rasterScale(source.widthPx, source.heightPx, options);
    if (scale > 0.999) {
      return `Original resolution ${source.widthPx} x ${source.heightPx} px · about ${size} on devices`;
    }
    const outLong = Math.max(1, Math.round(longEdge * scale));
    return `About ${size} on devices · ${outLong} px from the original ${longEdge} px`;
  }
  if (
    options.maxRasterEdgePx >=
    mapAssetNormalizeOptionsFromQuality(MAP_ASSET_QUALITY_MAX).maxRasterEdgePx
  ) {
    return `About ${size} on devices · original resolution`;
  }
  return `About ${size} on devices · images up to ${options.maxRasterEdgePx} px`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${Math.max(1, Math.round(bytes))} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Estimate the normalized device payload. Pure arithmetic — the API
 * exposes this so the Control Centre does not invent GDAL sizing rules.
 */
export function estimateNormalizedMapAsset(
  input: PostMapAssetEstimateInput
): PostMapAssetEstimateResponse {
  const source = MapAssetEstimateSourceSchema.parse(input.source);
  const kind = source.kind ?? mapAssetKindFromFilename(source.filename);
  if (!kind) {
    throw new Error(`Estimate needs ${MAP_ASSET_PRIMARY_FORMATS}.`);
  }
  const {quality, options} = resolveMapAssetNormalizeOptions({
    quality: input.quality,
    options: input.options,
  });
  const estimatedByteSize =
    kind === 'image'
      ? estimateRasterBytes(source, options, quality)
      : estimateVectorBytes(source, options);
  const simplifyMb = Math.max(
    1,
    Math.round(options.vectorSimplifyBytes / (1024 * 1024))
  );
  const summary =
    kind === 'image'
      ? imageSummary(source, options, estimatedByteSize)
      : `About ${formatBytes(estimatedByteSize)} on devices · vectors simplified above ${simplifyMb} MB`;
  return {
    kind,
    quality,
    options,
    estimatedByteSize,
    originalByteSize: source.byteSize,
    summary,
  };
}
