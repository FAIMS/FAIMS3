/**
 * Shared export format and full-export include-flag types.
 *
 * Used by the export API, Control Centre forms, and the persistable
 * download-grant document. Query-string parsing (`'true'` / `'false'`) stays
 * at the HTTP boundary; this module is the boolean / enum models.
 */

import {z} from 'zod';

/** Formats accepted by `GET /notebooks/:id/records/export`. */
export const ExportFormatSchema = z.enum([
  'csv',
  'zip',
  'geojson',
  'kml',
  'geopackage',
  'full',
]);
export type ExportFormat = z.infer<typeof ExportFormatSchema>;

/**
 * Include flags for `format === 'full'`. All fields are required on the
 * persisted grant; apply {@link DEFAULT_FULL_EXPORT_CONFIG} at mint / parse
 * time, not as Zod defaults on this schema.
 */
export const FullExportConfigSchema = z.object({
  includeTabular: z.boolean(),
  includeAttachments: z.boolean(),
  includeGeoJSON: z.boolean(),
  includeKML: z.boolean(),
  includeGeoPackage: z.boolean(),
  includeMetadata: z.boolean(),
});
export type FullExportConfig = z.infer<typeof FullExportConfigSchema>;

/** Default full-export include flags — include everything. */
export const DEFAULT_FULL_EXPORT_CONFIG: FullExportConfig = {
  includeTabular: true,
  includeAttachments: true,
  includeGeoJSON: true,
  includeKML: true,
  includeGeoPackage: true,
  includeMetadata: true,
};
