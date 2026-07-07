import {MapConfig, MapStylesheetNameType} from '@faims3/forms';
import {Resource, resourceRoles} from '@faims3/data-model';
import pluralize from 'pluralize';
import {z} from 'zod';
import {capitalize} from './lib/utils';

/*
 * Configuration is parsed from Vite's `import.meta.env` using a two-pass zod
 * pipeline:
 *   - Pass one (EnvSchema) validates/narrows the raw environment into strings
 *     (assembled with explicit static `import.meta.env.VITE_*` accesses so Vite
 *     performs its build-time replacement).
 *   - Pass two (ConfigSchema + a little custom logic for required, derived or
 *     inter-dependent values) produces the typed `config` singleton.
 *
 * The `config` singleton is the source of truth. The individual named exports
 * below are retained (deriving from `config`) so existing call sites and the
 * many derived helpers in this module remain stable.
 */

const TRUTHY_STRINGS = ['true', '1', 'on', 'yes'];
const FALSEY_STRINGS = ['false', '0', 'off', 'no'];

// Long Lived Token Configuration
const DEFAULT_MAXIMUM_LONG_LIVED_DURATION_DAYS = 90;
// This is the default set - clamped to max
const DEFAULT_HINTS = [1, 5, 10, 30, 90, 365];

// ---------------------------------------------------------------------------
// Pass one: read and validate the raw environment into (optional) strings.
// ---------------------------------------------------------------------------

const EnvSchema = z.object({
  VITE_NOTEBOOK_NAME: z.string().optional(),
  VITE_WEBSITE_TITLE: z.string().optional(),
  VITE_APP_NAME: z.string().optional(),
  VITE_APP_SHORT_NAME: z.string().optional(),
  VITE_WEB_URL: z.string().optional(),
  VITE_API_URL: z.string().optional(),
  VITE_APP_URL: z.string().optional(),
  VITE_DOCS_URL: z.string().optional(),
  VITE_APP_THEME: z.string().optional(),
  VITE_DEVELOPER_MODE: z.string().optional(),
  VITE_EXCLUDED_TEAM_ROLES: z.string().optional(),
  VITE_FORCE_REMOTE_DELETION: z.string().optional(),
  VITE_DELETE_ON_DEACTIVATION: z.string().optional(),
  VITE_MAXIMUM_LONG_LIVED_DURATION_DAYS: z.string().optional(),
  VITE_LONG_LIVED_TOKEN_DURATION_HINTS: z.string().optional(),
  VITE_MAP_SOURCE: z.string().optional(),
  VITE_SATELLITE_SOURCE: z.string().optional(),
  VITE_MAP_SOURCE_KEY: z.string().optional(),
  VITE_MAP_STYLE: z.string().optional(),
  VITE_BUGSNAG_API_KEY: z.string().optional(),
});

const rawEnv = EnvSchema.parse({
  VITE_NOTEBOOK_NAME: import.meta.env.VITE_NOTEBOOK_NAME,
  VITE_WEBSITE_TITLE: import.meta.env.VITE_WEBSITE_TITLE,
  VITE_APP_NAME: import.meta.env.VITE_APP_NAME,
  VITE_APP_SHORT_NAME: import.meta.env.VITE_APP_SHORT_NAME,
  VITE_WEB_URL: import.meta.env.VITE_WEB_URL,
  VITE_API_URL: import.meta.env.VITE_API_URL,
  VITE_APP_URL: import.meta.env.VITE_APP_URL,
  VITE_DOCS_URL: import.meta.env.VITE_DOCS_URL,
  VITE_APP_THEME: import.meta.env.VITE_APP_THEME,
  VITE_DEVELOPER_MODE: import.meta.env.VITE_DEVELOPER_MODE,
  VITE_EXCLUDED_TEAM_ROLES: import.meta.env.VITE_EXCLUDED_TEAM_ROLES,
  VITE_FORCE_REMOTE_DELETION: import.meta.env.VITE_FORCE_REMOTE_DELETION,
  VITE_DELETE_ON_DEACTIVATION: import.meta.env.VITE_DELETE_ON_DEACTIVATION,
  VITE_MAXIMUM_LONG_LIVED_DURATION_DAYS: import.meta.env
    .VITE_MAXIMUM_LONG_LIVED_DURATION_DAYS,
  VITE_LONG_LIVED_TOKEN_DURATION_HINTS: import.meta.env
    .VITE_LONG_LIVED_TOKEN_DURATION_HINTS,
  VITE_MAP_SOURCE: import.meta.env.VITE_MAP_SOURCE,
  VITE_SATELLITE_SOURCE: import.meta.env.VITE_SATELLITE_SOURCE,
  VITE_MAP_SOURCE_KEY: import.meta.env.VITE_MAP_SOURCE_KEY,
  VITE_MAP_STYLE: import.meta.env.VITE_MAP_STYLE,
  VITE_BUGSNAG_API_KEY: import.meta.env.VITE_BUGSNAG_API_KEY,
});

// ---------------------------------------------------------------------------
// Reusable pass-two field builders.
// ---------------------------------------------------------------------------

const isBlank = (v: string | undefined): v is undefined | '' =>
  v === undefined || v === '';

const stringFromEnv = (def: string) =>
  z
    .string()
    .optional()
    .transform(v => (isBlank(v) ? def : v));

// ---------------------------------------------------------------------------
// Pass two: build the typed configuration values.
// ---------------------------------------------------------------------------

const ConfigSchema = z.object({
  notebookName: stringFromEnv('project'),
  websiteTitle: stringFromEnv('Control Centre'),
  docsUrl: stringFromEnv(''),
  appTheme: stringFromEnv('default'),
  developerMode: z
    .string()
    .optional()
    .transform(v => v === 'true'),
  forceRemoteDeletion: z
    .string()
    .optional()
    .transform((v): ForceRemoteDeletionMode => {
      if (v === 'allow') return 'allow';
      if (v !== undefined && v !== '' && v !== 'never') {
        console.warn(
          `VITE_FORCE_REMOTE_DELETION invalid (${v}); use allow or never. Assuming never.`
        );
      }
      return 'never';
    }),
  deleteOnDeactivation: z
    .string()
    .optional()
    .transform(v => {
      if (isBlank(v)) return false;
      const lower = v.toLowerCase();
      if (TRUTHY_STRINGS.includes(lower)) return true;
      if (FALSEY_STRINGS.includes(lower)) return false;
      console.warn(
        `VITE_DELETE_ON_DEACTIVATION invalid (${v}); assuming false. Use true or false.`
      );
      return false;
    }),
  maximumLongLivedDurationDays: z
    .string()
    .optional()
    .transform((v): number | undefined => {
      if (isBlank(v)) {
        console.log(
          'VITE_MAXIMUM_LONG_LIVED_DURATION_DAYS not set, using default: ' +
            DEFAULT_MAXIMUM_LONG_LIVED_DURATION_DAYS
        );
        return DEFAULT_MAXIMUM_LONG_LIVED_DURATION_DAYS;
      }
      if (['unlimited', 'infinite', 'none'].includes(v.toLowerCase())) {
        console.log('Long-lived tokens configured for unlimited duration');
        return undefined;
      }
      const parsedDays = parseInt(v, 10);
      if (isNaN(parsedDays) || parsedDays <= 0) {
        console.warn(
          `Invalid value "${v}" for VITE_MAXIMUM_LONG_LIVED_DURATION_DAYS. Must be a positive integer or "unlimited".`
        );
        console.log('Falling back to default configuration.');
        return DEFAULT_MAXIMUM_LONG_LIVED_DURATION_DAYS;
      }
      return parsedDays;
    }),
  mapSource: stringFromEnv('osm'),
  mapSourceKey: stringFromEnv(''),
  mapStyle: z
    .string()
    .optional()
    .transform(
      (v): MapStylesheetNameType =>
        isBlank(v) ? 'basic' : (v as MapStylesheetNameType)
    ),
  satelliteSource: z
    .string()
    .optional()
    .transform((v): 'esri' | 'maptiler' | undefined =>
      v !== 'esri' && v !== 'maptiler' ? undefined : v
    ),
  bugsnagApiKey: z
    .string()
    .optional()
    .transform((v): string | undefined => {
      if (isBlank(v)) {
        console.log('VITE_BUGSNAG_API_KEY not set, error reporting disabled');
        return undefined;
      }
      return v;
    }),
});

const parsedConfig = ConfigSchema.parse({
  notebookName: rawEnv.VITE_NOTEBOOK_NAME,
  websiteTitle: rawEnv.VITE_WEBSITE_TITLE,
  docsUrl: rawEnv.VITE_DOCS_URL,
  appTheme: rawEnv.VITE_APP_THEME,
  developerMode: rawEnv.VITE_DEVELOPER_MODE,
  forceRemoteDeletion: rawEnv.VITE_FORCE_REMOTE_DELETION,
  deleteOnDeactivation: rawEnv.VITE_DELETE_ON_DEACTIVATION,
  maximumLongLivedDurationDays: rawEnv.VITE_MAXIMUM_LONG_LIVED_DURATION_DAYS,
  mapSource: rawEnv.VITE_MAP_SOURCE,
  mapSourceKey: rawEnv.VITE_MAP_SOURCE_KEY,
  mapStyle: rawEnv.VITE_MAP_STYLE,
  satelliteSource: rawEnv.VITE_SATELLITE_SOURCE,
  bugsnagApiKey: rawEnv.VITE_BUGSNAG_API_KEY,
});

// ---------------------------------------------------------------------------
// Required and derived / inter-dependent values.
// ---------------------------------------------------------------------------

/** Returns a required env value, throwing if it is missing/empty. */
function requiredEnv(value: string | undefined, key: string): string {
  if (isBlank(value)) {
    throw new Error(`Missing required env variable ${key}`);
  }
  return value;
}

function buildAppName(): string {
  return requiredEnv(rawEnv.VITE_APP_NAME, 'VITE_APP_NAME');
}

function buildExcludedTeamRoles(): Set<string> {
  const validTeamRoles = new Set(
    resourceRoles[Resource.TEAM].map(r => r.role as string)
  );

  const requested =
    rawEnv.VITE_EXCLUDED_TEAM_ROLES?.split(',')
      .map(s => s.trim())
      .filter(Boolean) ?? [];

  const invalid = requested.filter(r => !validTeamRoles.has(r));
  if (invalid.length > 0) {
    console.warn(
      `VITE_EXCLUDED_TEAM_ROLES contains values that are not team roles and will be ignored: ${invalid.join(', ')}`
    );
  }

  return new Set(requested.filter(r => validTeamRoles.has(r)));
}

/**
 * Duration hints for long-lived tokens. Parses a CSV of integers and clamps
 * them to the maximum expiry window if set.
 */
function buildLongLivedTokenDurationHints(
  maximumDays: number | undefined
): number[] {
  const hintsEnv = rawEnv.VITE_LONG_LIVED_TOKEN_DURATION_HINTS;

  let hints: number[];

  if (isBlank(hintsEnv)) {
    console.log('VITE_LONG_LIVED_TOKEN_DURATION_HINTS not set, using defaults');
    hints = DEFAULT_HINTS;
  } else {
    try {
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
  if (maximumDays !== undefined) {
    hints = hints.filter(hint => hint <= maximumDays);
    if (hints.length === 0) {
      console.warn(
        `All duration hints exceed maximum duration of ${maximumDays} days. Adding maximum as hint.`
      );
      hints = [maximumDays];
    }
  }

  // Sort hints in ascending order and remove duplicates
  return [...new Set(hints)].sort((a, b) => a - b);
}

const appName = buildAppName();

/**
 * The singleton Control Centre configuration object. Prefer reading values
 * from here; the named exports below derive from it.
 */
export const config = {
  ...parsedConfig,
  appName,
  appShortName: isBlank(rawEnv.VITE_APP_SHORT_NAME)
    ? appName
    : rawEnv.VITE_APP_SHORT_NAME,
  webUrl: requiredEnv(rawEnv.VITE_WEB_URL, 'VITE_WEB_URL'),
  apiUrl: requiredEnv(rawEnv.VITE_API_URL, 'VITE_API_URL'),
  appUrl: requiredEnv(rawEnv.VITE_APP_URL, 'VITE_APP_URL'),
  excludedTeamRoles: buildExcludedTeamRoles(),
  longLivedTokenDurationHints: buildLongLivedTokenDurationHints(
    parsedConfig.maximumLongLivedDurationDays
  ),
};

export type Config = typeof config;

// ---------------------------------------------------------------------------
// Named exports (derived from `config`) — retained for call-site stability.
// ---------------------------------------------------------------------------

export const NOTEBOOK_NAME = config.notebookName;
export const WEBSITE_TITLE = config.websiteTitle;
export const APP_NAME = config.appName;
export const APP_SHORT_NAME = config.appShortName;
export const WEB_URL = config.webUrl;
export const API_URL = config.apiUrl;
export const APP_URL = config.appUrl;
export const DOCS_URL = config.docsUrl;
export const APP_THEME = config.appTheme;

export const NOTEBOOK_NAME_CAPITALIZED = capitalize(config.notebookName);

/** Lowercase plural, from `VITE_NOTEBOOK_NAME` (same rules as the Field Mark app). */
export const NOTEBOOK_NAME_PLURAL = pluralize(NOTEBOOK_NAME);

/** Plural with first letter capitalised — use for headings and labels. */
export const NOTEBOOK_NAME_PLURAL_CAPITALIZED =
  capitalize(NOTEBOOK_NAME_PLURAL);

/** Replace `{notebook}` / `{notebooks}` placeholders with the deployment's notebook name. */
export const brandNotebook = (text: string): string =>
  text
    .replaceAll('{notebooks}', NOTEBOOK_NAME_PLURAL)
    .replaceAll('{notebook}', NOTEBOOK_NAME);

export const DEVELOPER_MODE = config.developerMode;

/** Team roles to hide from team-role dropdowns (`VITE_EXCLUDED_TEAM_ROLES`). */
export const EXCLUDED_TEAM_ROLES = config.excludedTeamRoles;

/**
 * When the directory lists a notebook as archived (or id absent), the mobile app
 * may drop local DBs after sync (`allow`) or keep them closed but recoverable (`never`).
 * Set via VITE_FORCE_REMOTE_DELETION; must match the Field Mark app build for accurate web copy.
 */
export type ForceRemoteDeletionMode = 'allow' | 'never';

export const FORCE_REMOTE_DELETION = config.forceRemoteDeletion;

export const DELETE_ON_DEACTIVATION = config.deleteOnDeactivation;

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

export const MAXIMUM_LONG_LIVED_DURATION_DAYS =
  config.maximumLongLivedDurationDays;

export const LONG_LIVED_TOKEN_DURATION_HINTS =
  config.longLivedTokenDurationHints;
export const INVITE_TOKEN_HINTS = DEFAULT_HINTS;

// Help link to use for the long lived token docs
export const LONG_LIVED_TOKEN_HELP_LINK =
  'https://github.com/FAIMS/FAIMS3/blob/main/docs/developer/docs/source/markdown/Long-lived-tokens.md';

// get the map configuration
export function getMapConfig(): MapConfig {
  return {
    mapSource: config.mapSource,
    mapSourceKey: config.mapSourceKey,
    mapStyle: config.mapStyle,
    satelliteSource: config.satelliteSource,
  };
}

export const BUGSNAG_API_KEY = config.bugsnagApiKey;

/**
 * Gets the app version from Vite's __APP_VERSION__ replacement or environment variables.
 * Falls back to 'unknown' if not configured.
 * @returns The app version.
 */
function getVersion(): string {
  // First try the Vite define replacement (set at build time)
  const version = __APP_VERSION__;
  if (version) {
    console.info(`Using APP_VERSION from build: ${__APP_VERSION__}`);
    return version;
  }

  console.warn('__APP_VERSION__ not set in build. Using "unknown"');
  return 'unknown';
}

export const APP_VERSION = getVersion();
