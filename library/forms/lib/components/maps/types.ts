import z from 'zod';
import {MapStylesheetNameType} from './styles';

export type MapConfig = {
  mapSource: string;
  mapSourceKey: string;
  mapStyle: MapStylesheetNameType;
  satelliteSource?: 'esri' | 'maptiler';
};

/**
 * Schema for the GeoJSON geometry object.
 * Validates the structure without being overly strict on coordinate formats.
 */
export const GeoJSONGeometrySchema = z.object({
  type: z.enum(['Point', 'Polygon', 'LineString']),
  coordinates: z.any(), // Coordinate validation is complex; keep flexible
});

/**
 * Schema for a single GeoJSON feature.
 */
export const GeoJSONFeatureSchema = z.object({
  type: z.literal('Feature'),
  geometry: GeoJSONGeometrySchema,
  properties: z.any().nullable(),
});

/**
 * Schema for the field value - a GeoJSON FeatureCollection.
 */
export const GeoJSONFeatureCollectionSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(GeoJSONFeatureSchema),
});

/**
 * Schema for GeoJSON that can be either a Feature or a FeatureCollection
 */
export const GeoJSONFeatureOrCollectionSchema = z.discriminatedUnion('type', [
  GeoJSONFeatureCollectionSchema,
  GeoJSONFeatureSchema,
]);
export type GeoJSONFeatureOrCollection = z.infer<
  typeof GeoJSONFeatureOrCollectionSchema
>;
