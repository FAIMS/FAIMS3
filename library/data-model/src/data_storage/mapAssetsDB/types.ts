// SPDX-License-Identifier: Apache-2.0
import {z} from 'zod';
import {DatabaseInterface} from '../../types';
import {CouchExistingDocumentSchema} from '../utils';
import {
  MapAssetNormalizeOptionsSchema,
  MapAssetQualitySchema,
} from './normalizeOptions';

/** Couch attachment holding the bytes the user uploaded (or a zip of them). */
export const MAP_ASSET_ORIGINAL_ATTACHMENT = 'original';
/** Couch attachment holding the device-ready GeoJSON or PNG. */
export const MAP_ASSET_NORMALIZED_ATTACHMENT = 'normalized';

export const MAP_ASSET_DOC_TYPE = 'asset' as const;
export const MAP_ASSET_LINK_DOC_TYPE = 'link' as const;

export const MapAssetKindSchema = z.enum(['geojson', 'image']);
export type MapAssetKind = z.infer<typeof MapAssetKindSchema>;

export const MapAssetStatusSchema = z.enum(['processing', 'ready', 'failed']);
export type MapAssetStatus = z.infer<typeof MapAssetStatusSchema>;

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
  labelField: z.string().min(1).optional(),
  opacity: z.number().min(0).max(1),
});
export type MapAssetStyle = z.infer<typeof MapAssetStyleSchema>;

export const DEFAULT_MAP_ASSET_STYLE: MapAssetStyle = {
  stroke: '#1565c0',
  fill: '#1565c040',
  lineWidth: 2,
  pointSize: 6,
  opacity: 0.85,
};

export const MapAssetFieldsSchema = z.object({
  docType: z.literal(MAP_ASSET_DOC_TYPE),
  name: z.string().min(1),
  description: z.string(),
  /** Absent when the uploading user owns the asset individually. */
  ownedByTeamId: z.string().min(1).optional(),
  createdBy: z.string().min(1),
  originalFilename: z.string().min(1),
  /**
   * Extra upload files (world file, `.prj`) stored as
   * `companion-<filename>` attachments beside `original`.
   */
  companionFilenames: z.array(z.string().min(1)).optional(),
  /** Byte size of the normalized attachment once `status` is `ready`. */
  byteSize: z.number().nonnegative(),
  /** SHA-256 hex of the normalized bytes. Set when `status` is `ready`. */
  contentHash: z.string().min(1).optional(),
  status: MapAssetStatusSchema,
  failureReason: z.string().optional(),
  /**
   * Epoch ms when an API process claimed this `processing` asset.
   * Missing, or older than the claim timeout, means another process may retry.
   */
  processingStartedAt: z.number().optional(),
  /**
   * How many times a process has claimed this upload. Counts crashes, not
   * GDAL errors (those set `failed` immediately). Reset when the file is replaced.
   */
  processingAttempts: z.number().int().nonnegative().optional(),
  kind: MapAssetKindSchema.optional(),
  /** Bounding box of the normalized data in EPSG:4326. */
  extent4326: MapExtentSchema.optional(),
  /** Image placement extent in EPSG:3857. Present when `kind` is `image`. */
  extent3857: MapExtentSchema.optional(),
  defaultStyle: MapAssetStyleSchema,
  /** Slider value used when this upload was processed. */
  quality: MapAssetQualitySchema.optional(),
  /** Resolved GDAL settings used when this upload was processed. */
  normalizeOptions: MapAssetNormalizeOptionsSchema.optional(),
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
  assetId: z.string().min(1),
  projectId: z.string().min(1),
  linkedBy: z.string().min(1),
  createdAt: z.number(),
});
export type MapAssetLinkFields = z.infer<typeof MapAssetLinkFieldsSchema>;

export const ExistingMapAssetLinkSchema = CouchExistingDocumentSchema.extend(
  MapAssetLinkFieldsSchema.shape
);
export type ExistingMapAssetLink = z.infer<typeof ExistingMapAssetLinkSchema>;

export type MapAssetsDBFields = MapAssetFields | MapAssetLinkFields;
export type MapAssetsDB = DatabaseInterface<MapAssetsDBFields>;

/** One ready layer as it appears on a survey listing. */
export const ContextualLayerListingSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: MapAssetKindSchema,
  byteSize: z.number().nonnegative(),
  contentHash: z.string().min(1),
  extent: MapExtentSchema,
  extent3857: MapExtentSchema.optional(),
  defaultStyle: MapAssetStyleSchema,
});
export type ContextualLayerListing = z.infer<
  typeof ContextualLayerListingSchema
>;

export const GetMapAssetResponseSchema = ExistingMapAssetSchema;
export type GetMapAssetResponse = ExistingMapAsset;

export const GetMapAssetListResponseSchema = z.object({
  assets: z.array(ExistingMapAssetSchema),
});
export type GetMapAssetListResponse = z.infer<
  typeof GetMapAssetListResponseSchema
>;

export const PostMapAssetLinkInputSchema = z.object({
  projectId: z.string().min(1),
});
export type PostMapAssetLinkInput = z.infer<typeof PostMapAssetLinkInputSchema>;

/** Attachment name for a companion upload file. */
export function companionAttachmentName(filename: string): string {
  return `companion-${filename}`;
}
