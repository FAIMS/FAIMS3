/**
 * @file The GeoJSON a plan can carry: simple Point / LineString / Polygon
 * features in a FeatureCollection, the shape the MapFormField stores. Kept in
 * data-model (rather than reusing @faims3/forms' schemas) so plans do not
 * depend on the forms package.
 */
import z from 'zod';

/** The simple geometry types a spatial form field stores. */
export const PLAN_GEOMETRY_TYPES = ['Point', 'LineString', 'Polygon'] as const;
export type PlanGeometryType = (typeof PLAN_GEOMETRY_TYPES)[number];

/** A GeoJSON position: [lon, lat] with an optional altitude. */
export const PlanPositionSchema = z.array(z.number()).min(2).max(3);
export type PlanPosition = z.infer<typeof PlanPositionSchema>;

/** A GeoJSON Point geometry. */
export const PlanPointGeometrySchema = z.object({
  type: z.literal('Point'),
  coordinates: PlanPositionSchema,
});

/** A GeoJSON LineString geometry. */
export const PlanLineStringGeometrySchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(PlanPositionSchema).min(2),
});

/** A GeoJSON Polygon geometry. */
export const PlanPolygonGeometrySchema = z.object({
  type: z.literal('Polygon'),
  // Each ring is closed, so it has at least four positions
  coordinates: z.array(z.array(PlanPositionSchema).min(4)).min(1),
});

/** One simple geometry, as a spatial field stores it. */
export const PlanGeometrySchema = z.discriminatedUnion('type', [
  PlanPointGeometrySchema,
  PlanLineStringGeometrySchema,
  PlanPolygonGeometrySchema,
]);
export type PlanGeometry = z.infer<typeof PlanGeometrySchema>;

/**
 * One feature of a planned entry's geometry. `properties` is present (possibly
 * null), matching what the MapFormField's own schema requires of a feature.
 */
export const PlanFeatureSchema = z.object({
  type: z.literal('Feature'),
  geometry: PlanGeometrySchema,
  properties: z.record(z.string(), z.unknown()).nullable(),
});
export type PlanFeature = z.infer<typeof PlanFeatureSchema>;

/**
 * A planned entry's geometry: one or more simple features. Several features
 * are how an entry carries more than one spatial reference.
 */
export const PlanFeatureCollectionSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(PlanFeatureSchema).min(1),
});
export type PlanFeatureCollection = z.infer<typeof PlanFeatureCollectionSchema>;

/** Deep-copy a feature collection so callers cannot share plan geometry by reference. */
export const clonePlanFeatureCollection = (
  collection: PlanFeatureCollection
): PlanFeatureCollection => JSON.parse(JSON.stringify(collection));
