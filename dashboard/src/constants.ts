import {MapConfig, MapStylesheetNameType} from '@faims3/forms';

const getConfigValue = (key: string) => {
  const value = (import.meta.env[key] as string | undefined) ?? '';
  if (value === '') {
    throw new Error(`Missing required env variable ${key}`);
  }
  return value;
};

export const DASHBOARD_TITLE =
  import.meta.env.VITE_DASHBOARD_TITLE || 'FAIMS Dashboard';

export const DASHBOARD_URL = getConfigValue('VITE_DASHBOARD_URL');
export const API_URL = getConfigValue('VITE_API_URL');

/** CouchDB public URL for dashboard sync (no trailing slash). Default: http://localhost:5984 */
export const COUCHDB_URL =
  (import.meta.env.VITE_COUCHDB_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:5984';

/** How often to check if the access token needs refreshing (ms). */
export const TOKEN_CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds

/** Refresh the access token when it has less than this long until expiry (ms). */
export const TOKEN_REFRESH_BUFFER_MS = 60 * 1000; // 1 minute

// Login path for the dashboard – redirect back here after auth.
export const SIGNIN_PATH = `${API_URL}/login?redirect=${DASHBOARD_URL}`;

function get_map_source(): string {
  const map_source = import.meta.env.VITE_MAP_SOURCE;
  return map_source || 'osm';
}

function get_satellite_source(): 'esri' | 'maptiler' | undefined {
  const map_source = import.meta.env.VITE_SATELLITE_SOURCE;
  return map_source !== 'esri' && map_source !== 'maptiler'
    ? undefined
    : map_source;
}

function get_map_key(): string {
  const map_key = import.meta.env.VITE_MAP_SOURCE_KEY;
  return map_key || '';
}

function get_map_style(): MapStylesheetNameType {
  const map_style = import.meta.env.VITE_MAP_STYLE;
  return map_style || 'basic';
}

export function getMapConfig(): MapConfig {
  return {
    mapSource: get_map_source(),
    mapSourceKey: get_map_key(),
    mapStyle: get_map_style(),
    satelliteSource: get_satellite_source(),
  };
}

