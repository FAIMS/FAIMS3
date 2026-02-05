/**
 * Types and configuration for comprehensive notebook exports.
 *
 * The comprehensive export creates a single ZIP archive containing:
 * - CSV files for each view (tabular data)
 * - Attachment files organized by view/field
 * - GeoJSON spatial export
 * - KML spatial export
 * - Metadata JSON with export statistics
 */

import {z} from 'zod';

/**
 * Configuration schema for comprehensive export options.
 * All options default to true if not specified.
 */
export const ComprehensiveExportConfigSchema = z.object({
  includeTabular: z.boolean().default(true),
  includeAttachments: z.boolean().default(true),
  includeGeoJSON: z.boolean().default(true),
  includeKML: z.boolean().default(true),
  includeMetadata: z.boolean().default(true),
});

export type ComprehensiveExportConfig = z.infer<
  typeof ComprehensiveExportConfigSchema
>;

/**
 * Default configuration - include everything
 */
export const DEFAULT_COMPREHENSIVE_EXPORT_CONFIG: ComprehensiveExportConfig = {
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
 * Complete metadata for a comprehensive export
 */
export interface ComprehensiveExportMetadata {
  /** Project identifier */
  projectId: string;

  /** ISO timestamp of when export was generated */
  exportedAt: string;

  /** User who initiated the export */
  exportedBy: string;

  /** Configuration used for this export */
  config: ComprehensiveExportConfig;

  /** Per-view statistics */
  views: {
    viewId: string;
    label: string;
    recordCount: number;
    attachmentCount: number;
  }[];

  /** Aggregate totals */
  totals: {
    views: number;
    records: number;
    attachments: number;
    spatialFeatures: number;
  };

  /** Files included in the archive */
  includedFiles: {
    csvFiles: string[];
    attachmentFolders: string[];
    spatialFiles: string[];
    metadataFile: string | null;
  };

  /** Any warnings or issues encountered during export */
  warnings: string[];
}

/**
 * Extended download token payload for comprehensive exports
 */
export interface ComprehensiveDownloadTokenPayload {
  projectID: string;
  format: 'comprehensive';
  userID: string;
  config: ComprehensiveExportConfig;
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
