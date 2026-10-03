/**
 * Types and configuration for full notebook exports.
 *
 * The full export creates a single ZIP archive containing:
 * - CSV files for each view (tabular data)
 * - Attachment files organized by view/field
 * - GeoJSON spatial export
 * - KML spatial export
 * - GeoPackage spatial export
 * - Metadata JSON with export statistics
 */

import type {FullExportConfig} from '@faims3/data-model';

export {
  DEFAULT_FULL_EXPORT_CONFIG,
  FullExportConfigSchema,
} from '@faims3/data-model';
export type {FullExportConfig};

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
 * Statistics for spatial exports (GeoJSON, KML, or GeoPackage).
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
