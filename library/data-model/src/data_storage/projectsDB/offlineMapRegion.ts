import {z} from 'zod';

/**
 * Recommended offline map download region stored on a project (EPSG:4326).
 * Represented as a GeoJSON polygon — typically a rectangle bounding box.
 */
export const OfflineMapRegionSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
});
export type OfflineMapRegion = z.infer<typeof OfflineMapRegionSchema>;
