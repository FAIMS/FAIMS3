import {MapConfig, MapStylesheetNameType} from '@faims3/forms';
import {capitalize} from './lib/utils';

const getConfigValue = (key: string) => {
  const value = (import.meta.env[key] as string | undefined) ?? '';
  if (value === '') {
    throw new Error(`Missing required env variable ${key}`);
  }
  return value;
};

export const NOTEBOOK_NAME = import.meta.env.VITE_NOTEBOOK_NAME || 'project';
export const WEBSITE_TITLE =
  import.meta.env.VITE_WEBSITE_TITLE || 'Control Centre';
export const APP_NAME = getConfigValue('VITE_APP_NAME');
export const APP_SHORT_NAME = import.meta.env.VITE_APP_SHORT_NAME || APP_NAME;
export const WEB_URL = getConfigValue('VITE_WEB_URL');
export const API_URL = getConfigValue('VITE_API_URL');
export const APP_URL = getConfigValue('VITE_APP_URL');
export const APP_THEME = import.meta.env.VITE_APP_THEME || 'default';

export const NOTEBOOK_NAME_CAPITALIZED = import.meta.env.VITE_NOTEBOOK_NAME
  ? capitalize(import.meta.env.VITE_NOTEBOOK_NAME)
  : 'Project';

export const DEVELOPER_MODE = import.meta.env.VITE_DEVELOPER_MODE === 'true';

export const SIGNIN_PATH = `${API_URL}/login?redirect=${WEB_URL}`;

// this is where the /app will accept a ?token query string
export const APP_TOKEN_RETURN_PATH = APP_URL + '/auth-return';

/**
 * Builds a suitable register URL which will redirect back to the targeted
 * location - requires an invite
 * @returns The full address to redirect the window to
 */
export function buildRegisterUrl({
  redirect,
  inviteId,
}: {
  redirect: string;
  inviteId: string;
}) {
  return `${API_URL}/register?redirect=${redirect}&inviteId=${inviteId}`;
}

// Token refresh interval (every 3 minutes)
export const REFRESH_INTERVAL = 3 * 60 * 1000;

// Long Lived Token Configuration
const DEFAULT_MAXIMUM_LONG_LIVED_DURATION_DAYS = 90;

/**
 * Gets the maximum duration in days for long-lived tokens from environment variables.
 * @returns Maximum number of days, or undefined for unlimited duration
 */
function getMaximumLongLivedDurationDays(): number | undefined {
  const maxDays = import.meta.env.VITE_MAXIMUM_LONG_LIVED_DURATION_DAYS;

  if (maxDays === '' || maxDays === undefined) {
    console.log(
      'VITE_MAXIMUM_LONG_LIVED_DURATION_DAYS not set, using default: ' +
        DEFAULT_MAXIMUM_LONG_LIVED_DURATION_DAYS
    );
    return DEFAULT_MAXIMUM_LONG_LIVED_DURATION_DAYS;
  }

  // Check for explicit "unlimited" or "infinite" values
  if (['unlimited', 'infinite', 'none'].includes(maxDays.toLowerCase())) {
    console.log('Long-lived tokens configured for unlimited duration');
    return undefined;
  }

  const parsedDays = parseInt(maxDays, 10);
  if (isNaN(parsedDays) || parsedDays <= 0) {
    console.warn(
      `Invalid value "${maxDays}" for VITE_MAXIMUM_LONG_LIVED_DURATION_DAYS. Must be a positive integer or "unlimited".`
    );
    console.log('Falling back to default configuration.');
    return DEFAULT_MAXIMUM_LONG_LIVED_DURATION_DAYS;
  }

  return parsedDays;
}

export const MAXIMUM_LONG_LIVED_DURATION_DAYS =
  getMaximumLongLivedDurationDays();

// This is the default set - clamped to max
const DEFAULT_HINTS = [1, 5, 10, 30, 90, 365];

/**
 * Gets the duration hints for long-lived tokens from environment variables.
 * Parses a CSV of integers and clamps them to the maximum expiry window if set.
 * @returns Array of duration hints in days
 */
function getLongLivedTokenDurationHints(): number[] {
  const hintsEnv = import.meta.env.VITE_LONG_LIVED_TOKEN_DURATION_HINTS as
    | string
    | undefined;

  let hints: number[];

  if (hintsEnv === '' || hintsEnv === undefined) {
    console.log('VITE_LONG_LIVED_TOKEN_DURATION_HINTS not set, using defaults');
    hints = DEFAULT_HINTS;
  } else {
    try {
      // Parse CSV of integers
      const parsedHints = hintsEnv
        .split(',')
        .map(str => str.trim())
        .map(str => parseInt(str, 10))
        .filter(num => !isNaN(num) && num > 0);

      if (parsedHints.length === 0) {
        console.warn(
          `Invalid CSV format for VITE_LONG_LIVED_TOKEN_DURATION_HINTS: "${hintsEnv}". Using defaults.`
        );
        hints = DEFAULT_HINTS;
      } else {
        hints = parsedHints;
      }
    } catch (error) {
      console.warn(
        `Error parsing VITE_LONG_LIVED_TOKEN_DURATION_HINTS: "${hintsEnv}". Using defaults.`,
        error
      );
      hints = DEFAULT_HINTS;
    }
  }

  // Clamp hints to maximum duration if set
  if (MAXIMUM_LONG_LIVED_DURATION_DAYS !== undefined) {
    hints = hints.filter(hint => hint <= MAXIMUM_LONG_LIVED_DURATION_DAYS);
    if (hints.length === 0) {
      console.warn(
        `All duration hints exceed maximum duration of ${MAXIMUM_LONG_LIVED_DURATION_DAYS} days. Adding maximum as hint.`
      );
      hints = [MAXIMUM_LONG_LIVED_DURATION_DAYS];
    }
  }

  // Sort hints in ascending order and remove duplicates
  return [...new Set(hints)].sort((a, b) => a - b);
}

export const LONG_LIVED_TOKEN_DURATION_HINTS = getLongLivedTokenDurationHints();
export const INVITE_TOKEN_HINTS = DEFAULT_HINTS;

// Help link to use for the long lived token docs
export const LONG_LIVED_TOKEN_HELP_LINK =
  'https://github.com/FAIMS/FAIMS3/blob/main/docs/developer/docs/source/markdown/Long-lived-tokens.md';

/**
 * Map source configuration.  Define the map source
 * (see src/gui/components/map/tile_source.ts for options)
 * and the map key if required.
 */

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

// get the map configuration
export function getMapConfig(): MapConfig {
  return {
    mapSource: get_map_source(),
    mapSourceKey: get_map_key(),
    mapStyle: get_map_style(),
    satelliteSource: get_satellite_source(),
  };
}
