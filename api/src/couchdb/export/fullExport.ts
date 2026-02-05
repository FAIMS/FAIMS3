/**
 * FullExport Module
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
  appendBothSpatialFormatsToArchive,
  appendGeoJSONToArchive,
  appendKMLToArchive,
  projectHasSpatialFields,
} from './geospatialExport';
import {
  FullExportConfig,
  FullExportMetadata,
  DEFAULT_FULL_EXPORT_CONFIG,
  ROCrateMetadata,
  slugifyLabel,
} from './types';

/**
 * Streams a full notebook export as a ZIP archive.
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
export const streamFullExport = async ({
  projectId,
  userId,
  config = DEFAULT_FULL_EXPORT_CONFIG,
  res,
}: {
  projectId: ProjectID;
  userId: string;
  config?: FullExportConfig;
  res: NodeJS.WritableStream;
}): Promise<void> => {
  console.log(
    `[FULL] Starting export for project ${projectId} with config:`,
    config
  );

  // Initialize metadata structure
  const metadata: FullExportMetadata = {
    projectId,
    exportedAt: new Date().toISOString(),
    exportedBy: userId,
    config,
    views: [],
    totals: {views: 0, records: 0, attachments: 0, spatialFeatures: 0},
    includedFiles: [], // Changed to string[]
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
      console.log('[FULL] Exporting CSV files (single-pass)...');

      try {
        const csvStats = await appendAllCSVsToArchive({
          projectId,
          archive,
          pathPrefix: 'records/',
        });

        // Process stats for each view
        for (const viewStat of csvStats.views) {
          usedCsvFilenames.push(viewStat.filename);

          // Update or create view entry
          let viewEntry = metadata.views.find(
            v => v.viewId === viewStat.viewId
          );
          if (!viewEntry) {
            viewEntry = {
              viewId: viewStat.viewId,
              label: viewStat.viewLabel,
              recordCount: viewStat.recordCount,
              attachmentCount: 0,
            };
            metadata.views.push(viewEntry);
          }

          viewEntry.recordCount = viewStat.recordCount;
          viewEntry.csvPath = viewStat.filename;
          metadata.includedFiles.push(viewStat.filename);

          console.log(
            `[FULL] CSV for ${viewStat.viewLabel}: ${viewStat.recordCount} records`
          );
        }

        metadata.totals.records = csvStats.totalRecords;
        console.log(
          `[FULL] CSV export complete: ${csvStats.totalRecords} total records across ${csvStats.views.length} views`
        );
      } catch (err) {
        const message = `Failed to export CSVs: ${err instanceof Error ? err.message : 'Unknown error'}`;
        console.error(`[FULL] ${message}`);
        metadata.warnings.push(message);
      }
    }

    // =========================================================================
    // 2. Attachment Export
    // =========================================================================
    if (config.includeAttachments) {
      console.log('[FULL] Exporting attachments...');

      try {
        const attachmentStats = await appendAttachmentsToArchive({
          projectId,
          archive,
          pathPrefix: 'attachments/',
        });

        // Update view-level attachment counts
        for (const [viewId, count] of attachmentStats.perViewCounts) {
          let viewEntry = metadata.views.find(v => v.viewId === viewId);
          if (!viewEntry) {
            const viewLabel = uiSpec.viewsets[viewId]?.label ?? viewId;
            viewEntry = {
              viewId,
              label: viewLabel,
              recordCount: 0,
              attachmentCount: count,
            };
            metadata.views.push(viewEntry);
          }

          viewEntry.attachmentCount = count;
          if (count > 0) {
            const folderPath = `attachments/${viewId}/`;
            viewEntry.attachmentPath = folderPath;
            metadata.includedFiles.push(folderPath);
          }
        }

        metadata.totals.attachments = attachmentStats.fileCount;

        console.log(`[FULL] Attachments: ${attachmentStats.fileCount} files`);
      } catch (err) {
        const message = `Failed to export attachments: ${err instanceof Error ? err.message : 'Unknown error'}`;
        console.error(`[FULL] ${message}`);
        metadata.warnings.push(message);
      }
    }

    // =========================================================================
    // 3. Spatial Export (GeoJSON and/or KML) - Single DB pass if both requested
    // =========================================================================
    const wantsGeoJSON = config.includeGeoJSON;
    const wantsKML = config.includeKML;

    if (wantsGeoJSON || wantsKML) {
      console.log('[FULL] Exporting spatial data...');

      try {
        const hasSpatial = await projectHasSpatialFields(projectId);

        if (!hasSpatial) {
          if (wantsGeoJSON) {
            metadata.warnings.push(
              'No spatial fields found in project - GeoJSON export skipped'
            );
          }
          if (wantsKML) {
            metadata.warnings.push(
              'No spatial fields found in project - KML export skipped'
            );
          }
          console.log('[FULL] No spatial fields, skipping spatial exports');
        } else if (wantsGeoJSON && wantsKML) {
          // Both formats requested - use single-pass combined export
          console.log('[FULL] Exporting both GeoJSON and KML (single pass)...');

          const spatialStats = await appendBothSpatialFormatsToArchive({
            projectId,
            archive,
            geojsonFilename: 'spatial/export.geojson',
            kmlFilename: 'spatial/export.kml',
          });

          if (spatialStats.geojson.featureCount > 0) {
            metadata.includedFiles.push(spatialStats.geojson.filename);
            metadata.totals.spatialFeatures = spatialStats.geojson.featureCount;
          }

          if (spatialStats.kml.featureCount > 0) {
            metadata.includedFiles.push(spatialStats.kml.filename);
          }

          console.log(
            `[FULL] Spatial export complete: ${spatialStats.geojson.featureCount} features`
          );
        } else if (wantsGeoJSON) {
          // Only GeoJSON requested
          const geojsonStats = await appendGeoJSONToArchive({
            projectId,
            archive,
            filename: 'spatial/export.geojson',
          });

          if (geojsonStats.featureCount > 0) {
            metadata.includedFiles.push(geojsonStats.filename);
            metadata.totals.spatialFeatures = geojsonStats.featureCount;
          }

          console.log(`[FULL] GeoJSON: ${geojsonStats.featureCount} features`);
        } else if (wantsKML) {
          // Only KML requested
          const kmlStats = await appendKMLToArchive({
            projectId,
            archive,
            filename: 'spatial/export.kml',
          });

          if (kmlStats.featureCount > 0) {
            metadata.includedFiles.push(kmlStats.filename);
            metadata.totals.spatialFeatures = kmlStats.featureCount;
          }

          console.log(`[FULL] KML: ${kmlStats.featureCount} features`);
        }
      } catch (err) {
        const message = `Failed to export spatial data: ${err instanceof Error ? err.message : 'Unknown error'}`;
        console.error(`[FULL] ${message}`);
        metadata.warnings.push(message);
      }
    }

    // =========================================================================
    // 5. Metadata JSON (written last so it includes all statistics)
    // =========================================================================
    if (config.includeMetadata) {
      const roCrate: ROCrateMetadata = {
        '@context': 'https://w3id.org/ro/crate/1.1/context',
        '@graph': [
          {
            '@id': 'ro-crate-metadata.json',
            '@type': 'CreativeWork',
            conformsTo: {'@id': 'https://w3id.org/ro/crate/1.1'},
            about: {'@id': './'},
          },
          {
            '@id': './',
            '@type': 'Dataset',
            name: `Export of Project ${metadata.projectId}`,
            datePublished: metadata.exportedAt,
            author: {'@id': '#author'},
            hasPart: metadata.includedFiles.map(path => ({'@id': path})),
            spatialFeatures: metadata.totals.spatialFeatures,
          },
          {
            '@id': '#author',
            '@type': 'Person',
            name: metadata.exportedBy,
          },
        ],
      };

      // Add Detailed Entities for every View
      metadata.views.forEach(view => {
        // Add CSV metadata if it exists
        if (view.csvPath) {
          roCrate['@graph'].push({
            '@id': view.csvPath,
            '@type': 'File',
            name: `${view.label} (Records)`,
            description: `Tabular data for ${view.label}`,
            encodingFormat: 'text/csv',
            recordCount: view.recordCount,
          });
        }

        // Add Attachment Folder metadata if it exists
        if (view.attachmentPath) {
          roCrate['@graph'].push({
            '@id': view.attachmentPath,
            '@type': 'Dataset',
            name: `${view.label} (Attachments)`,
            description: `Media and file attachments for ${view.label}`,
            attachmentCount: view.attachmentCount,
          });
        }
      });

      // Add Spatial file metadata
      metadata.includedFiles.forEach(path => {
        if (path.startsWith('spatial/')) {
          roCrate['@graph'].push({
            '@id': path,
            '@type': 'File',
            name: path.endsWith('.geojson')
              ? 'GeoJSON Spatial Data'
              : 'KML Spatial Data',
            encodingFormat: path.endsWith('.geojson')
              ? 'application/geo+json'
              : 'application/vnd.google-earth.kml+xml',
          });
        }
      });

      archive.append(JSON.stringify(roCrate, null, 2), {
        name: 'ro-crate-metadata.json',
      });
    }

    // =========================================================================
    // Finalize
    // =========================================================================
    console.log('[FULL] Finalizing archive...');
    await archive.finalize();

    console.log(
      `[FULL] Export complete. Total: ${metadata.totals.records} records, ${metadata.totals.attachments} attachments, ${metadata.totals.spatialFeatures} spatial features`
    );
  } catch (error) {
    console.error('[FULL] Fatal error during export:', error);
    throw new Error(
      `Failed to create full export: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

/**
 * Helper to generate a suggested filename for the full export
 */
export const generateFullExportFilename = (projectId: string): string => {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const slug = slugifyLabel(projectId);
  return `${slug}-export-${timestamp}.zip`;
};
