import {z} from 'zod';

/**
 * Recommended offline map download region stored on a project (EPSG:4326).
 *
 * GeoJSON polygon — typically a rectangle bounding box drawn in Control Centre.
 * Synced from the server on activation and metadata refresh; compared with the
 * region stored on local tile sets to detect stale downloads.
 */
export const OfflineMapRegionSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
});
export type OfflineMapRegion = z.infer<typeof OfflineMapRegionSchema>;
