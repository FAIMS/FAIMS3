// SPDX-License-Identifier: Apache-2.0
import {z} from 'zod';
import {
  IdInputSchema,
  INPUT_LIMITS,
  resourceNameString,
} from '../../inputLimits';
import {DatabaseInterface} from '../../types';
import {RootDescriptionInputSchema} from '../rootMetadata';
import {CouchExistingDocumentSchema} from '../utils';

/**
 * Formats accepted as a map-layer primary. Keep UI copy and API errors
 * aligned with this phrase.
 */
export const MAP_ASSET_PRIMARY_FORMATS =
  'a GeoJSON, GeoPackage, zipped shapefile or File Geodatabase, KML, GeoTIFF, georeferenced PDF, or a PNG/JPEG';

export const MAP_ASSET_VECTOR_EXTENSIONS = [
  '.geojson',
  '.json',
  '.gpkg',
  '.kml',
  '.zip',
] as const;

export const MAP_ASSET_RASTER_EXTENSIONS = [
  '.tif',
  '.tiff',
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
] as const;

export const MAP_ASSET_PRIMARY_EXTENSIONS = [
  ...MAP_ASSET_VECTOR_EXTENSIONS,
  ...MAP_ASSET_RASTER_EXTENSIONS,
] as const;

export const MAP_ASSET_WORLD_FILE_EXTENSIONS = [
  '.pgw',
  '.gfw',
  '.jgw',
  '.wld',
  '.tfw',
  '.j2w',
] as const;

export const MAP_ASSET_PRJ_EXTENSION = '.prj' as const;

export const MAP_ASSET_ALLOWED_UPLOAD_EXTENSIONS = [
  ...MAP_ASSET_PRIMARY_EXTENSIONS,
  ...MAP_ASSET_WORLD_FILE_EXTENSIONS,
  MAP_ASSET_PRJ_EXTENSION,
] as const;

/** `accept` value for a map-layer file input. */
export const MAP_ASSET_UPLOAD_ACCEPT =
  MAP_ASSET_ALLOWED_UPLOAD_EXTENSIONS.join(',');

export const MAP_ASSET_IMAGE_COMPANION_MESSAGE =
  'PNG and JPEG need a world file and a .prj.';

const PRIMARY_EXTENSION_SET: ReadonlySet<string> = new Set(
  MAP_ASSET_PRIMARY_EXTENSIONS
);
const VECTOR_EXTENSION_SET: ReadonlySet<string> = new Set(
  MAP_ASSET_VECTOR_EXTENSIONS
);
const WORLD_FILE_EXTENSION_SET: ReadonlySet<string> = new Set(
  MAP_ASSET_WORLD_FILE_EXTENSIONS
);
const ALLOWED_UPLOAD_EXTENSION_SET: ReadonlySet<string> = new Set(
  MAP_ASSET_ALLOWED_UPLOAD_EXTENSIONS
);

/** Basename extension, lowercased, including the leading dot. */
export function mapAssetFileExtension(filename: string): string {
  const base = filename.replace(/^.*[/\\]/, '');
  const dot = base.lastIndexOf('.');
  return dot <= 0 ? '' : base.slice(dot).toLowerCase();
}

/** True when the extension is a vector primary (GeoJSON, GPKG, KML, ZIP). */
export function isMapAssetVectorExtension(extension: string): boolean {
  return VECTOR_EXTENSION_SET.has(extension);
}

/** True when the extension is a map-layer primary, vector or raster. */
export function isMapAssetPrimaryExtension(extension: string): boolean {
  return PRIMARY_EXTENSION_SET.has(extension);
}

/** True when the extension is a world-file companion (`.pgw`, `.tfw`, …). */
export function isMapAssetWorldFileExtension(extension: string): boolean {
  return WORLD_FILE_EXTENSION_SET.has(extension);
}

/** True when the extension may appear in a map-layer upload. */
export function isMapAssetAllowedUploadExtension(extension: string): boolean {
  return ALLOWED_UPLOAD_EXTENSION_SET.has(extension);
}

/** PNG and JPEG carry CRS in companion files, not in the image. */
export function isMapAssetGeoreferencedImageExtension(
  extension: string
): boolean {
  return extension === '.png' || extension === '.jpg' || extension === '.jpeg';
}

/** First primary extension in `extensions`, or `undefined` if none. */
export function mapAssetPrimaryExtension(
  extensions: readonly string[]
): string | undefined {
  return extensions.find(extension => isMapAssetPrimaryExtension(extension));
}

/**
 * When the primary is PNG or JPEG, require a world file and a `.prj`.
 * Other primaries carry CRS inside the file. Returns a user-facing message
 * or `undefined` when companions are not required or are present.
 */
export function mapAssetGeoreferencedImageCompanionIssue(
  extensions: readonly string[]
): string | undefined {
  const primary = mapAssetPrimaryExtension(extensions);
  if (!primary || !isMapAssetGeoreferencedImageExtension(primary)) {
    return undefined;
  }
  const hasWorld = extensions.some(extension =>
    isMapAssetWorldFileExtension(extension)
  );
  if (!hasWorld || !extensions.includes(MAP_ASSET_PRJ_EXTENSION)) {
    return MAP_ASSET_IMAGE_COMPANION_MESSAGE;
  }
  return undefined;
}

/** Object-store key for the bytes the user uploaded (or a zip of them). */
export const MAP_ASSET_ORIGINAL_ATTACHMENT = 'original';
/** Object-store key for the device-ready PMTiles archive. */
export const MAP_ASSET_NORMALIZED_ATTACHMENT = 'normalized';

/**
 * Object-store location persisted on the Couch map-asset document.
 * Bytes live in the attachment store; Couch holds only this metadata.
 *
 * `resourceUri` is opaque at this layer — the `provider` decides how to
 * interpret it. For `provider: 's3'` the URI is
 * `s3://{region}/{bucket}/{key}` (the key may contain slashes).
 *
 * `endpoint` is S3-only: a custom host for RustFS or another S3-compatible
 * store. Omit it when talking to AWS S3.
 */
export const StoredAttachmentLocationSchema = z.object({
  provider: z.literal('s3'),
  resourceUri: z.string().min(1),
  contentType: z.string().min(1),
  byteSize: z.number().nonnegative(),
  /** S3-compatible custom endpoint (e.g. local RustFS). Ignored for AWS S3. */
  endpoint: z.string().min(1).optional(),
});
export type StoredAttachmentLocation = z.infer<
  typeof StoredAttachmentLocationSchema
>;

export const MAP_ASSET_DOC_TYPE = 'asset' as const;
export const MAP_ASSET_LINK_DOC_TYPE = 'link' as const;

export const MapAssetKindSchema = z.enum(['raster-tiles', 'vector-tiles']);
export type MapAssetKind = z.infer<typeof MapAssetKindSchema>;

/** One PMTiles archive of image tiles or Mapbox vector tiles. */
export function isTiledMapAssetKind(kind: MapAssetKind): boolean {
  return kind === 'raster-tiles' || kind === 'vector-tiles';
}

/** Filename extension of the device-ready PMTiles archive. */
export function normalizedMapAssetExtension(_kind: MapAssetKind): 'pmtiles' {
  return 'pmtiles';
}

/** MIME type of the device-ready PMTiles archive. */
export function normalizedMapAssetMediaType(_kind: MapAssetKind): string {
  return 'application/vnd.pmtiles';
}

/** Short UI label for a tiled map-asset kind. */
export function mapAssetKindLabel(kind: MapAssetKind | undefined): string {
  switch (kind) {
    case 'raster-tiles':
      return 'Image tiles';
    case 'vector-tiles':
      return 'Vector tiles';
    default:
      return '';
  }
}

/**
 * Lifecycle of a map-layer ingest job.
 *
 * - `pending`: originals are on the way or already stored; no worker has claimed the job
 * - `processing`: a spatial worker holds the claim and is running GDAL
 * - `ready` / `failed`: terminal
 */
export const MapAssetStatusSchema = z.enum([
  'pending',
  'processing',
  'ready',
  'failed',
]);
export type MapAssetStatus = z.infer<typeof MapAssetStatusSchema>;

/** True while the layer is waiting for or held by a spatial worker. */
export function isMapAssetInProgress(
  status: MapAssetStatus | string
): status is 'pending' | 'processing' {
  return status === 'pending' || status === 'processing';
}

/** How many surveys a listing/detail payload says this layer is linked to. */
export function mapAssetLinkCount(asset: {linkCount?: number}): number {
  return asset.linkCount ?? 0;
}

/**
 * True when ingest has finished and no survey is linked yet. The Control
 * Centre shows this as “Ready to link” rather than a green Ready chip.
 */
export function isMapAssetReadyToLink(asset: {
  status: MapAssetStatus | string;
  linkCount?: number;
}): boolean {
  return asset.status === 'ready' && mapAssetLinkCount(asset) === 0;
}

/**
 * Steps a spatial job writes back to the asset while it is in progress.
 * The Control Centre maps these to short user-facing messages.
 */
export const MapAssetProcessingStageSchema = z.enum([
  'uploading',
  'queued',
  'downloading',
  'extracting-archive',
  'flattening-geojson',
  'interpreting-crs',
  'converting-geometries',
  'tiling-vectors',
  'warping-raster',
  'building-tiles',
  'building-overviews',
  'converting-tiles',
  'storing',
]);
export type MapAssetProcessingStage = z.infer<
  typeof MapAssetProcessingStageSchema
>;

/** User-facing copy for each processing stage id. */
export const MAP_ASSET_PROCESSING_STAGE_LABELS = {
  uploading: 'Uploading original files',
  queued: 'Waiting for a worker',
  downloading: 'Downloading data',
  'extracting-archive': 'Extracting archive',
  'flattening-geojson': 'Flattening nested collections',
  'interpreting-crs': 'Interpreting CRS',
  'converting-geometries': 'Converting geometries',
  'tiling-vectors': 'Building vector tiles',
  'warping-raster': 'Warping raster',
  'building-tiles': 'Building image tiles',
  'building-overviews': 'Building zoom overviews',
  'converting-tiles': 'Packaging tiles',
  storing: 'Saving prepared layer',
} as const satisfies Record<MapAssetProcessingStage, string>;

/** User-facing label for a processing stage id. */
export function mapAssetProcessingStageLabel(
  stage: MapAssetProcessingStage | undefined
): string | undefined {
  if (!stage) {
    return undefined;
  }
  return MAP_ASSET_PROCESSING_STAGE_LABELS[stage];
}

/** Live tippecanoe / GDAL progress while `processingStage` is set. */
export const MapAssetProcessingProgressSchema = z.object({
  phase: z.string().min(1).max(80),
  percent: z.number().min(0).max(100).optional(),
});
export type MapAssetProcessingProgress = z.infer<
  typeof MapAssetProcessingProgressSchema
>;

/** Phase text plus optional percent. */
export function formatMapAssetProcessingProgress(
  progress: MapAssetProcessingProgress
): string {
  if (progress.percent === undefined) {
    return progress.phase;
  }
  return `${progress.phase} ${Math.round(progress.percent)}%`;
}

/** Stage label, plus phase and percent when the worker has reported them. */
export function mapAssetProcessingStatusText(asset: {
  processingStage?: MapAssetProcessingStage;
  processingProgress?: MapAssetProcessingProgress;
}): string | undefined {
  const stageLabel = mapAssetProcessingStageLabel(asset.processingStage);
  if (!stageLabel) {
    return undefined;
  }
  if (!asset.processingProgress) {
    return stageLabel;
  }
  return `${stageLabel} — ${formatMapAssetProcessingProgress(asset.processingProgress)}`;
}

/** [minX, minY, maxX, maxY] */
export const MapExtentSchema = z.tuple([
  z.number(),
  z.number(),
  z.number(),
  z.number(),
]);
export type MapExtent = z.infer<typeof MapExtentSchema>;

/**
 * Paint defaults stored on the asset. Devices start from these and may
 * override visibility, opacity, order, and vector paint locally.
 */
export const MapAssetStyleSchema = z.object({
  stroke: z.string().min(1),
  fill: z.string().min(1),
  lineWidth: z.number().positive(),
  pointSize: z.number().positive(),
  opacity: z.number().min(0).max(1),
});
export type MapAssetStyle = z.infer<typeof MapAssetStyleSchema>;

/** Default paint stored on a new map-layer asset. */
export const DEFAULT_MAP_ASSET_STYLE: MapAssetStyle = {
  stroke: '#1565c0',
  fill: '#1565c040',
  lineWidth: 2,
  pointSize: 6,
  opacity: 0.85,
};

export const MapAssetDetailsSchema = z.object({
  name: resourceNameString('Layer name'),
  description: RootDescriptionInputSchema,
});
export type MapAssetDetails = z.infer<typeof MapAssetDetailsSchema>;

export const MapAssetFieldsSchema = z.object({
  docType: z.literal(MAP_ASSET_DOC_TYPE),
  name: resourceNameString('Layer name'),
  description: RootDescriptionInputSchema,
  /** Absent when the uploading user owns the asset individually. */
  ownedByTeamId: IdInputSchema.min(1).optional(),
  createdBy: IdInputSchema.min(1),
  originalFilename: z.string().min(1).max(INPUT_LIMITS.SHORT_TEXT_MAX_LENGTH),
  /**
   * Extra upload files (world file, `.prj`) stored beside `original`
   * under `companion-<filename>` object keys.
   */
  companionFilenames: z
    .array(z.string().min(1).max(INPUT_LIMITS.SHORT_TEXT_MAX_LENGTH))
    .optional(),
  /**
   * Object-store locations keyed by attachment id (`original`,
   * `companion-<filename>`, `normalized`). Each value is a provider
   * plus a `resourceUri` the provider understands. Couch holds only
   * these pointers; the bytes are not Couch attachments.
   */
  storedAttachments: z
    .record(z.string(), StoredAttachmentLocationSchema)
    .optional(),
  /** Byte size of the normalized file once `status` is `ready`. */
  byteSize: z.number().nonnegative(),
  /** SHA-256 hex of the normalized bytes. Set when `status` is `ready`. */
  contentHash: z.string().min(1).optional(),
  status: MapAssetStatusSchema,
  failureReason: z.string().optional(),
  /**
   * Epoch ms when a spatial worker claimed this asset (`status` is then
   * `processing`). Absent on `pending`. This is the claim token. Another
   * worker may retry when `updatedAt` (last stage/progress write) is older
   * than the claim timeout.
   */
  processingStartedAt: z.number().optional(),
  /**
   * How many times a process has claimed this upload. Counts crashes, not
   * GDAL errors (those set `failed` immediately). Reset when the file is replaced.
   */
  processingAttempts: z.number().int().nonnegative().optional(),
  /**
   * Current step while `status` is `pending` or `processing`. Cleared when
   * the job reaches `ready` or `failed`.
   */
  processingStage: MapAssetProcessingStageSchema.optional(),
  /**
   * Phase and percent inside the current step (tippecanoe tiling or GDAL
   * warp/translate/overviews). Cleared with `processingStage`.
   */
  processingProgress: MapAssetProcessingProgressSchema.optional(),
  kind: MapAssetKindSchema.optional(),
  /** Bounding box of the normalized data in EPSG:4326. */
  extent4326: MapExtentSchema.optional(),
  /** Raster placement extent in EPSG:3857. Present for image tiles. */
  extent3857: MapExtentSchema.optional(),
  /**
   * XYZ zoom range of a PMTiles archive. The archive header is the source
   * of truth when the file is opened; these fields let a listing describe
   * the pyramid before that read.
   */
  minZoom: z.number().int().nonnegative().max(30).optional(),
  maxZoom: z.number().int().nonnegative().max(30).optional(),
  /** Tile edge in pixels. PMTiles image tiles are 256. */
  tileSize: z.number().int().min(64).max(512).optional(),
  defaultStyle: MapAssetStyleSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type MapAssetFields = z.infer<typeof MapAssetFieldsSchema>;

export const ExistingMapAssetSchema = CouchExistingDocumentSchema.extend(
  MapAssetFieldsSchema.shape
);
export type ExistingMapAsset = z.infer<typeof ExistingMapAssetSchema>;

export const MapAssetLinkFieldsSchema = z.object({
  docType: z.literal(MAP_ASSET_LINK_DOC_TYPE),
  assetId: IdInputSchema.min(1),
  projectId: IdInputSchema.min(1),
  linkedBy: IdInputSchema.min(1),
  createdAt: z.number(),
});
export type MapAssetLinkFields = z.infer<typeof MapAssetLinkFieldsSchema>;

export const ExistingMapAssetLinkSchema = CouchExistingDocumentSchema.extend(
  MapAssetLinkFieldsSchema.shape
);
export type ExistingMapAssetLink = z.infer<typeof ExistingMapAssetLinkSchema>;

export type MapAssetsDBFields = MapAssetFields | MapAssetLinkFields;
export type MapAssetsDB = DatabaseInterface<MapAssetsDBFields>;

/**
 * One ready layer as it appears on a survey listing.
 * Pending, processing, and failed assets are never listed; field devices use
 * this array as the keep-set and drop any on-device file whose id is absent.
 */
export const ContextualLayerListingSchema = z.object({
  id: IdInputSchema.min(1),
  name: resourceNameString('Layer name'),
  kind: MapAssetKindSchema,
  byteSize: z.number().nonnegative(),
  contentHash: z.string().min(1),
  extent: MapExtentSchema,
  extent3857: MapExtentSchema.optional(),
  minZoom: z.number().int().nonnegative().max(30).optional(),
  maxZoom: z.number().int().nonnegative().max(30).optional(),
  tileSize: z.number().int().min(64).max(512).optional(),
  defaultStyle: MapAssetStyleSchema,
});
export type ContextualLayerListing = z.infer<
  typeof ContextualLayerListingSchema
>;

/**
 * Couch asset plus how many surveys it is linked to. `linkCount` is computed
 * at read time and is not stored on the asset document.
 */
export const MapAssetWithLinkCountSchema = ExistingMapAssetSchema.extend({
  linkCount: z.number().int().nonnegative(),
});
export type MapAssetWithLinkCount = z.infer<typeof MapAssetWithLinkCountSchema>;

export const GetMapAssetResponseSchema = MapAssetWithLinkCountSchema;
export type GetMapAssetResponse = MapAssetWithLinkCount;

export const GetMapAssetListResponseSchema = z.object({
  assets: z.array(MapAssetWithLinkCountSchema),
});
export type GetMapAssetListResponse = z.infer<
  typeof GetMapAssetListResponseSchema
>;

/**
 * Presigned download for the device-ready file. Clients fetch `url`
 * directly from object storage — Conductor does not stream the bytes.
 */
export const GetMapAssetDownloadUrlResponseSchema = z.object({
  url: z.string().min(1),
  mediaType: z.string().min(1),
  filename: z.string().min(1),
  byteSize: z.number().nonnegative(),
  expiresInSeconds: z.number().int().positive(),
});
export type GetMapAssetDownloadUrlResponse = z.infer<
  typeof GetMapAssetDownloadUrlResponseSchema
>;

export const PostMapAssetLinkInputSchema = z.object({
  projectId: IdInputSchema.min(1),
});
export type PostMapAssetLinkInput = z.infer<typeof PostMapAssetLinkInputSchema>;

/** Attachment name for a companion upload file. */
export function companionAttachmentName(filename: string): string {
  return `companion-${filename}`;
}
