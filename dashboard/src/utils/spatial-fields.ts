import type {UISpecification} from '@faims3/data-model';
import {z} from 'zod';

/** Field type-returned values that typically hold GeoJSON (map/location). */
const SPATIAL_TYPE_RETURNED = new Set([
  'faims-core::JSON', // MapFormField
  'faims-pos::Location',
]);

/**
 * Collect field names from the UI spec that are spatial (map/location) types.
 */
export function getSpatialFieldNames(uiSpec: UISpecification): string[] {
  const names: string[] = [];
  const fields = (uiSpec as {fields?: Record<string, {['type-returned']?: string}>}).fields;
  if (!fields || typeof fields !== 'object') return names;

  for (const [name, config] of Object.entries(fields)) {
    const typeReturned = config?.['type-returned'];
    if (typeReturned && SPATIAL_TYPE_RETURNED.has(typeReturned)) {
      names.push(name);
    }
  }
  return names;
}

const GeoJSONPoint = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([z.number(), z.number()]),
});

const GeoJSONFeature = z.object({
  type: z.literal('Feature'),
  geometry: z.union([
    GeoJSONPoint,
    z.object({type: z.enum(['Polygon', 'LineString']), coordinates: z.any()}),
  ]),
  properties: z.any().nullable().optional(),
});

const GeoJSONFeatureCollection = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(GeoJSONFeature),
});

/** Parse raw field value to an array of GeoJSON features (point geometry only for map display). */
export function parseGeoJSONFromFieldData(data: unknown): Array<{type: 'Feature'; geometry: {type: 'Point'; coordinates: [number, number]}; properties?: unknown}> {
  if (data == null) return [];

  const parsed = GeoJSONFeatureCollection.safeParse(data);
  if (parsed.success) {
    return parsed.data.features.filter(
      (f): f is {type: 'Feature'; geometry: {type: 'Point'; coordinates: [number, number]}; properties?: unknown} =>
        f.geometry?.type === 'Point' && Array.isArray(f.geometry.coordinates) && f.geometry.coordinates.length >= 2
    ) as Array<{type: 'Feature'; geometry: {type: 'Point'; coordinates: [number, number]}; properties?: unknown}>;
  }

  const single = GeoJSONFeature.safeParse(data);
  if (single.success && single.data.geometry?.type === 'Point' && Array.isArray((single.data.geometry as {coordinates?: number[]}).coordinates)) {
    const geom = single.data.geometry as {type: 'Point'; coordinates: [number, number]};
    return [{type: 'Feature', geometry: geom, properties: (single.data as {properties?: unknown}).properties}];
  }

  return [];
}
