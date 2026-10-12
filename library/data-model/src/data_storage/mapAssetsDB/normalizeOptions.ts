// SPDX-License-Identifier: Apache-2.0
/**
 * Device-payload settings for a map-layer upload.
 *
 * Quality 50 is the historic default (4096 px rasters, simplify vectors
 * above 5 MB). The Control Centre slider sends `quality`; callers may
 * also pass explicit `options` to override individual fields.
 */

import {z} from 'zod';
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

export const MapAssetNormalizeOptionsSchema = z.object({
  /** Longest edge of the device PNG, in pixels. */
  maxRasterEdgePx: z.number().int().min(256).max(16384),
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
  maxRasterEdgePx: 8192,
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
  filename: z.string().min(1),
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
      return 2.8;
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

function estimateRasterBytes(
  source: MapAssetEstimateSource,
  options: MapAssetNormalizeOptions
): number {
  const pngBytesPerPixel = 1.6;
  if (source.widthPx && source.heightPx) {
    const longEdge = Math.max(source.widthPx, source.heightPx);
    const scale = Math.min(1, options.maxRasterEdgePx / longEdge);
    const outW = Math.max(1, Math.round(source.widthPx * scale));
    const outH = Math.max(1, Math.round(source.heightPx * scale));
    return Math.round(outW * outH * pngBytesPerPixel);
  }
  const capped =
    options.maxRasterEdgePx * options.maxRasterEdgePx * pngBytesPerPixel;
  return Math.round(
    Math.min(capped, Math.max(source.byteSize * 0.25, 64 * 1024))
  );
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
    throw new Error(
      'Estimate needs a GeoJSON, GeoPackage, zipped shapefile, KML, GeoTIFF, georeferenced PDF, or a PNG/JPEG.'
    );
  }
  const {quality, options} = resolveMapAssetNormalizeOptions({
    quality: input.quality,
    options: input.options,
  });
  const estimatedByteSize =
    kind === 'image'
      ? estimateRasterBytes(source, options)
      : estimateVectorBytes(source, options);
  const simplifyMb = Math.max(
    1,
    Math.round(options.vectorSimplifyBytes / (1024 * 1024))
  );
  const summary =
    kind === 'image'
      ? `About ${formatBytes(estimatedByteSize)} on devices · images up to ${options.maxRasterEdgePx} px`
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
