/**
 * Types and configuration for full notebook exports.
 *
 * The full export creates a single ZIP archive containing:
 * - CSV files for each view (tabular data)
 * - Attachment files organized by view/field
 * - GeoJSON spatial export
 * - KML spatial export
 * - Metadata JSON with export statistics
 */

import {z} from 'zod';

/**
 * Configuration schema for full export options.
 * All options default to true if not specified.
 */
export const FullExportConfigSchema = z.object({
  includeTabular: z.boolean().default(true),
  includeAttachments: z.boolean().default(true),
  includeGeoJSON: z.boolean().default(true),
  includeKML: z.boolean().default(true),
  includeMetadata: z.boolean().default(true),
});

export type FullExportConfig = z.infer<typeof FullExportConfigSchema>;

/**
 * Default configuration - include everything
 */
export const DEFAULT_FULL_EXPORT_CONFIG: FullExportConfig = {
  includeTabular: true,
  includeAttachments: true,
  includeGeoJSON: true,
  includeKML: true,
  includeMetadata: true,
};

/**
 * Statistics for a single view's CSV export
 */
export interface CSVExportStats {
  viewId: string;
  viewLabel: string;
  recordCount: number;
  filename: string;
}

/**
 * Statistics for attachment export
 */
export interface AttachmentExportStats {
  viewId: string;
  viewLabel: string;
  fileCount: number;
  folderPath: string;
}

/**
 * Statistics for spatial exports (GeoJSON/KML)
 */
export interface SpatialExportStats {
  featureCount: number;
  filename: string;
  hasSpatialFields: boolean;
}

/**
 * RO-Crate compatible metadata structure
 */
export interface ROCrateMetadata {
  '@context': 'https://w3id.org/ro/crate/1.1/context';
  '@graph': ROCrateEntity[];
}

export interface ROCrateEntity {
  '@id': string;
  '@type': string | string[];
  name?: string;
  description?: string;
  datePublished?: string;
  encodingFormat?: string;
  author?: {'@id': string};
  hasPart?: {'@id': string}[];
  conformsTo?: {'@id': string};
  about?: {'@id': string};
  // Custom properties (keeping your stats)
  recordCount?: number;
  attachmentCount?: number;
  spatialFeatures?: number;
}

/**
 * Update the existing metadata interface to serve as our working state
 * before we finalize it into the RO-Crate graph.
 */
export interface FullExportMetadata {
  projectId: string;
  exportedAt: string;
  exportedBy: string;
  config: FullExportConfig;
  views: {
    viewId: string;
    label: string;
    recordCount: number;
    attachmentCount: number;
    csvPath?: string;
    attachmentPath?: string;
  }[];
  totals: {
    views: number;
    records: number;
    attachments: number;
    spatialFeatures: number;
  };
  includedFiles: string[]; // Flat list of all paths for RO-Crate "hasPart"
  warnings: string[];
}

/**
 * Extended download token payload for full exports
 */
export interface FullDownloadTokenPayload {
  projectID: string;
  format: 'full';
  userID: string;
  config: FullExportConfig;
}

/**
 * Helper to create a slugified filename from a label
 */
export const slugifyLabel = (label: string): string => {
  return label
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '')
    .substring(0, 50); // Limit length
};

/**
 * Helper to ensure unique filenames in a list
 */
export const ensureUniqueFilename = (
  baseFilename: string,
  extension: string,
  existingFilenames: string[]
): string => {
  let filename = `${baseFilename}.${extension}`;
  let counter = 1;

  while (existingFilenames.includes(filename)) {
    filename = `${baseFilename}_${counter}.${extension}`;
    counter++;
  }

  return filename;
};
