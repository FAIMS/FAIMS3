/**
 * @file Explode a GeoJSON geometry into the simple geometries a spatial field
 * stores: a Multi* becomes one geometry per part, a GeometryCollection one per
 * member (recursively). This is how one source feature yields several spatial
 * references on a planned entry.
 */
import z from 'zod';
import {
  PlanGeometrySchema,
  PlanLineStringGeometrySchema,
  PlanPointGeometrySchema,
  PlanPolygonGeometrySchema,
  type PlanGeometry,
} from '../planGeoJson';

const multiPointSchema = z.object({
  type: z.literal('MultiPoint'),
  coordinates: z.array(PlanPointGeometrySchema.shape.coordinates).min(1),
});
const multiLineStringSchema = z.object({
  type: z.literal('MultiLineString'),
  coordinates: z.array(PlanLineStringGeometrySchema.shape.coordinates).min(1),
});
const multiPolygonSchema = z.object({
  type: z.literal('MultiPolygon'),
  coordinates: z.array(PlanPolygonGeometrySchema.shape.coordinates).min(1),
});
const geometryCollectionSchema = z.object({
  type: z.literal('GeometryCollection'),
  geometries: z.array(z.unknown()).min(1),
});

/** Outcome of exploding one geometry into simple parts. */
export type ExplodeResult =
  | {ok: true; geometries: PlanGeometry[]}
  | {ok: false; message: string};

/** Explode one geometry, or say why it cannot be. */
export const explodeGeometry = (geometry: unknown): ExplodeResult => {
  if (geometry === null || geometry === undefined) {
    return {ok: false, message: 'Feature has no geometry'};
  }
  const simple = PlanGeometrySchema.safeParse(geometry);
  if (simple.success) return {ok: true, geometries: [simple.data]};

  const multiPoint = multiPointSchema.safeParse(geometry);
  if (multiPoint.success) {
    return {
      ok: true,
      geometries: multiPoint.data.coordinates.map(coordinates => ({
        type: 'Point' as const,
        coordinates,
      })),
    };
  }
  const multiLine = multiLineStringSchema.safeParse(geometry);
  if (multiLine.success) {
    return {
      ok: true,
      geometries: multiLine.data.coordinates.map(coordinates => ({
        type: 'LineString' as const,
        coordinates,
      })),
    };
  }
  const multiPolygon = multiPolygonSchema.safeParse(geometry);
  if (multiPolygon.success) {
    return {
      ok: true,
      geometries: multiPolygon.data.coordinates.map(coordinates => ({
        type: 'Polygon' as const,
        coordinates,
      })),
    };
  }
  const collection = geometryCollectionSchema.safeParse(geometry);
  if (collection.success) {
    const geometries: PlanGeometry[] = [];
    for (const member of collection.data.geometries) {
      const exploded = explodeGeometry(member);
      if (!exploded.ok) return exploded;
      geometries.push(...exploded.geometries);
    }
    return {ok: true, geometries};
  }

  const type =
    typeof geometry === 'object' && 'type' in geometry
      ? String((geometry as {type: unknown}).type)
      : typeof geometry;
  return {
    ok: false,
    message: `Unsupported or malformed geometry (${type})`,
  };
};
