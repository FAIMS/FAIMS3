/**
 * FullExport Module
 *
 * Orchestrates a complete notebook export into a single ZIP archive containing:
 * - CSV files for each view (tabular data)
 * - Attachment files organized by view/field
 * - GeoJSON spatial export
 * - KML spatial export
 * - GeoPackage spatial export
 * - Metadata JSON with export statistics
 *
 * All streaming is memory-efficient, using bounded concurrency for attachments
 * and PassThrough streams for other content types. Spatial formats (GeoJSON,
 * KML, GeoPackage) share a single record iteration when exported together.
 */

import {ProjectID} from '@faims3/data-model';
import {isoDateOnly, nowIso} from '../../time';
import {getUiSpecModel} from '../notebooks';
import {
  appendAttachmentsToArchive,
  createConfiguredArchive,
} from './attachmentExport';
import {appendAllCSVsToArchive} from './csvExport';
import {
  appendSpatialFormatsToArchive,
  SpatialArchiveFormatConfig,
} from './geospatialExport';
import {GdalUnavailableError} from './gdal';
import {
  DEFAULT_FULL_EXPORT_CONFIG,
  FullExportConfig,
  FullExportMetadata,
  ROCrateMetadata,
} from './types';
import {slugifyLabel} from './utils';

/**
 * Streams a full notebook export as a ZIP archive.
 *
 * This function orchestrates multiple export types into a single archive:
 * 1. CSV files for each view (if includeTabular)
 * 2. Attachment files (if includeAttachments)
 * 3. GeoJSON spatial data (if includeGeoJSON)
 * 4. KML spatial data (if includeKML)
 * 5. GeoPackage spatial data (if includeGeoPackage)
 * 6. Metadata JSON (if includeMetadata)
 *
 * Architecture:
 * - Creates a single archiver instance
 * - Sequentially processes each export type to maintain predictable memory usage
 * - Uses PassThrough streams for CSV/GeoJSON/KML to avoid buffering
 * - Uses a single spatial record iteration when multiple of GeoJSON/KML/GeoPackage
 *   are requested (via {@link appendSpatialFormatsToArchive})
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
    exportedAt: nowIso(),
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
    const uiSpec = await getUiSpecModel(projectId);
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
    // 3. Spatial export — one record iteration fans out to all requested formats
    //    (GeoJSON stream, KML stream, and/or GeoPackage via temp files + ogr2ogr)
    // =========================================================================
    const wantsGeoJSON = config.includeGeoJSON;
    const wantsKML = config.includeKML;
    const wantsGeoPackage = config.includeGeoPackage;

    if (wantsGeoJSON || wantsKML || wantsGeoPackage) {
      console.log('[FULL] Exporting spatial data...');

      try {
        const formats: SpatialArchiveFormatConfig = {};
        if (wantsGeoJSON) {
          formats.geojson = {filename: 'spatial/export.geojson'};
        }
        if (wantsKML) {
          formats.kml = {filename: 'spatial/export.kml'};
        }
        if (wantsGeoPackage) {
          formats.geopackage = {filename: 'spatial/export.gpkg'};
        }

        const spatialResult = await appendSpatialFormatsToArchive({
          projectId,
          archive,
          formats,
        });

        if (!spatialResult.hasSpatialFields) {
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
          if (wantsGeoPackage) {
            metadata.warnings.push(
              'No spatial fields found in project - GeoPackage export skipped'
            );
          }
          console.log('[FULL] No spatial fields, skipping spatial exports');
        } else {
          if (spatialResult.geojson && spatialResult.geojson.featureCount > 0) {
            metadata.includedFiles.push(spatialResult.geojson.filename);
            metadata.totals.spatialFeatures =
              spatialResult.geojson.featureCount;
          }

          if (spatialResult.kml && spatialResult.kml.featureCount > 0) {
            metadata.includedFiles.push(spatialResult.kml.filename);
            if (metadata.totals.spatialFeatures === 0) {
              metadata.totals.spatialFeatures = spatialResult.kml.featureCount;
            }
          }

          if (
            spatialResult.geopackage &&
            spatialResult.geopackage.featureCount > 0
          ) {
            metadata.includedFiles.push(spatialResult.geopackage.filename);
            if (metadata.totals.spatialFeatures === 0) {
              metadata.totals.spatialFeatures =
                spatialResult.geopackage.featureCount;
            }
          }

          const featureCount =
            spatialResult.geojson?.featureCount ??
            spatialResult.kml?.featureCount ??
            spatialResult.geopackage?.featureCount ??
            0;
          // GeoJSON/KML counts include all geometries; GPKG may be lower when
          // geometry types are unsupported for layer export.
          console.log(
            `[FULL] Spatial export complete (single pass): ${featureCount} features`
          );
        }
      } catch (err) {
        if (err instanceof GdalUnavailableError) {
          throw err;
        }
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
  const timestamp = isoDateOnly();
  const slug = slugifyLabel(projectId);
  return `${slug}-export-${timestamp}.zip`;
};
