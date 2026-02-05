/**
 * Comprehensive Export Module
 *
 * Orchestrates a complete notebook export into a single ZIP archive containing:
 * - CSV files for each view (tabular data)
 * - Attachment files organized by view/field
 * - GeoJSON spatial export
 * - KML spatial export
 * - Metadata JSON with export statistics
 *
 * All streaming is memory-efficient, using bounded concurrency for attachments
 * and PassThrough streams for other content types.
 */

import {ProjectID} from '@faims3/data-model';
import {getProjectUIModel} from '../notebooks';
import {
  appendAttachmentsToArchive,
  createConfiguredArchive,
} from './attachmentExport';
import {appendAllCSVsToArchive} from './csvExport';
import {
  appendGeoJSONToArchive,
  appendKMLToArchive,
  projectHasSpatialFields,
} from './geospatialExport';
import {
  ComprehensiveExportConfig,
  ComprehensiveExportMetadata,
  DEFAULT_COMPREHENSIVE_EXPORT_CONFIG,
  slugifyLabel,
} from './types';

/**
 * Streams a comprehensive notebook export as a ZIP archive.
 *
 * This function orchestrates multiple export types into a single archive:
 * 1. CSV files for each view (if includeTabular)
 * 2. Attachment files (if includeAttachments)
 * 3. GeoJSON spatial data (if includeGeoJSON)
 * 4. KML spatial data (if includeKML)
 * 5. Metadata JSON (if includeMetadata)
 *
 * Architecture:
 * - Creates a single archiver instance
 * - Sequentially processes each export type to maintain predictable memory usage
 * - Uses PassThrough streams for CSV/GeoJSON/KML to avoid buffering
 * - Uses bounded concurrency for attachment streaming
 * - Collects statistics throughout for the metadata file
 *
 * @param projectId - The project ID to export
 * @param userId - The user ID initiating the export (for metadata)
 * @param config - Export configuration (which components to include)
 * @param res - Writable stream (typically HTTP response) for the ZIP archive
 */
export const streamComprehensiveExport = async ({
  projectId,
  userId,
  config = DEFAULT_COMPREHENSIVE_EXPORT_CONFIG,
  res,
}: {
  projectId: ProjectID;
  userId: string;
  config?: ComprehensiveExportConfig;
  res: NodeJS.WritableStream;
}): Promise<void> => {
  console.log(
    `[COMPREHENSIVE] Starting export for project ${projectId} with config:`,
    config
  );

  // Initialize metadata structure
  const metadata: ComprehensiveExportMetadata = {
    projectId,
    exportedAt: new Date().toISOString(),
    exportedBy: userId,
    config,
    views: [],
    totals: {
      views: 0,
      records: 0,
      attachments: 0,
      spatialFeatures: 0,
    },
    includedFiles: {
      csvFiles: [],
      attachmentFolders: [],
      spatialFiles: [],
      metadataFile: null,
    },
    warnings: [],
  };

  try {
    // Create the archive
    const archive = createConfiguredArchive(res);

    // Get project UI spec to enumerate views
    const uiSpec = await getProjectUIModel(projectId);
    const viewIds = Object.keys(uiSpec.viewsets);
    metadata.totals.views = viewIds.length;

    // Track used filenames to prevent collisions
    const usedCsvFilenames: string[] = [];

    // =========================================================================
    // 1. CSV Export (all views in single DB pass)
    // =========================================================================
    if (config.includeTabular) {
      console.log('[COMPREHENSIVE] Exporting CSV files (single-pass)...');

      try {
        const csvStats = await appendAllCSVsToArchive({
          projectId,
          archive,
          pathPrefix: 'records/',
        });

        // Process stats for each view
        for (const viewStat of csvStats.views) {
          usedCsvFilenames.push(viewStat.filename);
          metadata.includedFiles.csvFiles.push(viewStat.filename);

          // Update or create view entry
          const existingView = metadata.views.find(
            v => v.viewId === viewStat.viewId
          );
          if (existingView) {
            existingView.recordCount = viewStat.recordCount;
          } else {
            metadata.views.push({
              viewId: viewStat.viewId,
              label: viewStat.viewLabel,
              recordCount: viewStat.recordCount,
              attachmentCount: 0,
            });
          }

          console.log(
            `[COMPREHENSIVE] CSV for ${viewStat.viewLabel}: ${viewStat.recordCount} records`
          );
        }

        metadata.totals.records = csvStats.totalRecords;
        console.log(
          `[COMPREHENSIVE] CSV export complete: ${csvStats.totalRecords} total records across ${csvStats.views.length} views`
        );
      } catch (err) {
        const message = `Failed to export CSVs: ${err instanceof Error ? err.message : 'Unknown error'}`;
        console.error(`[COMPREHENSIVE] ${message}`);
        metadata.warnings.push(message);
      }
    }

    // =========================================================================
    // 2. Attachment Export
    // =========================================================================
    if (config.includeAttachments) {
      console.log('[COMPREHENSIVE] Exporting attachments...');

      try {
        const attachmentStats = await appendAttachmentsToArchive({
          projectId,
          archive,
          pathPrefix: 'attachments/',
        });

        // Update view-level attachment counts
        for (const [viewId, count] of attachmentStats.perViewCounts) {
          const viewEntry = metadata.views.find(v => v.viewId === viewId);
          if (viewEntry) {
            viewEntry.attachmentCount = count;
          } else {
            // View wasn't in CSV export (shouldn't happen, but handle it)
            const viewLabel = uiSpec.viewsets[viewId]?.label ?? viewId;
            metadata.views.push({
              viewId,
              label: viewLabel,
              recordCount: 0,
              attachmentCount: count,
            });
          }

          if (count > 0) {
            metadata.includedFiles.attachmentFolders.push(
              `attachments/${viewId}/`
            );
          }
        }

        metadata.totals.attachments = attachmentStats.fileCount;

        console.log(
          `[COMPREHENSIVE] Attachments: ${attachmentStats.fileCount} files`
        );
      } catch (err) {
        const message = `Failed to export attachments: ${err instanceof Error ? err.message : 'Unknown error'}`;
        console.error(`[COMPREHENSIVE] ${message}`);
        metadata.warnings.push(message);
      }
    }

    // =========================================================================
    // 3. GeoJSON Export
    // =========================================================================
    if (config.includeGeoJSON) {
      console.log('[COMPREHENSIVE] Exporting GeoJSON...');

      try {
        const hasSpatial = await projectHasSpatialFields(projectId);

        if (!hasSpatial) {
          metadata.warnings.push(
            'No spatial fields found in project - GeoJSON export skipped'
          );
          console.log('[COMPREHENSIVE] No spatial fields, skipping GeoJSON');
        } else {
          const geojsonStats = await appendGeoJSONToArchive({
            projectId,
            archive,
            filename: 'spatial/export.geojson',
          });

          if (geojsonStats.featureCount > 0) {
            metadata.includedFiles.spatialFiles.push(geojsonStats.filename);
            metadata.totals.spatialFeatures = geojsonStats.featureCount;
          }

          console.log(
            `[COMPREHENSIVE] GeoJSON: ${geojsonStats.featureCount} features`
          );
        }
      } catch (err) {
        const message = `Failed to export GeoJSON: ${err instanceof Error ? err.message : 'Unknown error'}`;
        console.error(`[COMPREHENSIVE] ${message}`);
        metadata.warnings.push(message);
      }
    }

    // =========================================================================
    // 4. KML Export
    // =========================================================================
    if (config.includeKML) {
      console.log('[COMPREHENSIVE] Exporting KML...');

      try {
        const hasSpatial = await projectHasSpatialFields(projectId);

        if (!hasSpatial) {
          metadata.warnings.push(
            'No spatial fields found in project - KML export skipped'
          );
          console.log('[COMPREHENSIVE] No spatial fields, skipping KML');
        } else {
          const kmlStats = await appendKMLToArchive({
            projectId,
            archive,
            filename: 'spatial/export.kml',
          });

          if (kmlStats.featureCount > 0) {
            metadata.includedFiles.spatialFiles.push(kmlStats.filename);
            // Don't double-count spatial features (already counted in GeoJSON)
            if (!config.includeGeoJSON) {
              metadata.totals.spatialFeatures = kmlStats.featureCount;
            }
          }

          console.log(`[COMPREHENSIVE] KML: ${kmlStats.featureCount} features`);
        }
      } catch (err) {
        const message = `Failed to export KML: ${err instanceof Error ? err.message : 'Unknown error'}`;
        console.error(`[COMPREHENSIVE] ${message}`);
        metadata.warnings.push(message);
      }
    }

    // =========================================================================
    // 5. Metadata JSON (written last so it includes all statistics)
    // =========================================================================
    if (config.includeMetadata) {
      console.log('[COMPREHENSIVE] Writing metadata...');

      const metadataFilename = 'metadata.json';
      metadata.includedFiles.metadataFile = metadataFilename;

      // Pretty-print the metadata for human readability
      const metadataJson = JSON.stringify(metadata, null, 2);
      archive.append(metadataJson, {name: metadataFilename});
    }

    // =========================================================================
    // Finalize
    // =========================================================================
    console.log('[COMPREHENSIVE] Finalizing archive...');
    await archive.finalize();

    console.log(
      `[COMPREHENSIVE] Export complete. Total: ${metadata.totals.records} records, ${metadata.totals.attachments} attachments, ${metadata.totals.spatialFeatures} spatial features`
    );
  } catch (error) {
    console.error('[COMPREHENSIVE] Fatal error during export:', error);
    throw new Error(
      `Failed to create comprehensive export: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

/**
 * Helper to generate a suggested filename for the comprehensive export
 */
export const generateComprehensiveExportFilename = (
  projectId: string
): string => {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const slug = slugifyLabel(projectId);
  return `${slug}-export-${timestamp}.zip`;
};
