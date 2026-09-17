/**
 * @file GeoJSON adapter: a FeatureCollection with one Feature per planned
 * entry. Geometry is passed on unvalidated; the explode stage checks it.
 */
import z from 'zod';
import type {SpatialFormatAdapter} from '../types';

const featureSchema = z.object({
  type: z.literal('Feature'),
  geometry: z.unknown(),
  properties: z.record(z.string(), z.unknown()).nullable().optional(),
});

const featureCollectionSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(featureSchema),
});

export const geoJsonAdapter: SpatialFormatAdapter = {
  format: 'geojson',
  label: 'GeoJSON',
  accept: ['.geojson', '.json', 'application/geo+json', 'application/json'],
  parse: source => {
    if (
      typeof source === 'object' &&
      source !== null &&
      (source as {type?: unknown}).type === 'Feature'
    ) {
      return {
        ok: false,
        message:
          'The file holds a single Feature; a FeatureCollection with one feature per planned record is needed',
      };
    }
    const result = featureCollectionSchema.safeParse(source);
    if (!result.success) {
      return {
        ok: false,
        message: 'The file is not a GeoJSON FeatureCollection',
      };
    }
    if (result.data.features.length === 0) {
      return {ok: false, message: 'The FeatureCollection has no features'};
    }
    return {
      ok: true,
      features: result.data.features.map((feature, index) => ({
        index,
        geometry: feature.geometry,
        properties: feature.properties ?? {},
      })),
    };
  },
};
