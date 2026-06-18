import type { MapConfig } from '@faims3/forms';
import { z } from 'zod';

const MapEnvSchema = z.object({
  VITE_MAP_SOURCE: z.string().optional().default('osm'),
  VITE_MAP_SOURCE_KEY: z.string().optional().default(''),
  VITE_MAP_STYLE: z
    .enum(['basic', 'openstreetmap', 'osm-bright', 'toner'])
    .optional()
    .default('basic'),
  VITE_SATELLITE_SOURCE: z.enum(['esri', 'maptiler']).optional(),
});

function readMapEnv() {
  return MapEnvSchema.parse({
    VITE_MAP_SOURCE: import.meta.env.VITE_MAP_SOURCE,
    VITE_MAP_SOURCE_KEY: import.meta.env.VITE_MAP_SOURCE_KEY,
    VITE_MAP_STYLE: import.meta.env.VITE_MAP_STYLE,
    VITE_SATELLITE_SOURCE: import.meta.env.VITE_SATELLITE_SOURCE,
  });
}

/** Map configuration for PreviewFormManager (mirrors web/app env pattern). */
export function getMapConfig(): MapConfig {
  const env = readMapEnv();
  const config: MapConfig = {
    mapSource: env.VITE_MAP_SOURCE,
    mapSourceKey: env.VITE_MAP_SOURCE_KEY,
    mapStyle: env.VITE_MAP_STYLE,
  };
  if (env.VITE_SATELLITE_SOURCE) {
    config.satelliteSource = env.VITE_SATELLITE_SOURCE;
  }
  return config;
}
