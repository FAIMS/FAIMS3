import {configHelpers, Resource, resourceRoles} from '@faims3/data-model';
import {MapConfig, MapStylesheetNameType} from '@faims3/forms';
import pluralize from 'pluralize';
import {z} from 'zod';
import {capitalize} from './lib/utils';

/*
 * Configuration is parsed from Vite's `import.meta.env` with a single zod
 * schema:
 *   - Each env key is declared once with its coercion / defaulting logic.
 *   - The raw object uses explicit static `import.meta.env.VITE_*` accesses so
 *     Vite performs its build-time replacement.
 *   - `.strip()` drops unrelated keys; a final `.transform()` renames ENV_KEYS
 *     into the camelCase `config` shape (and builds required / cross-field
 *     values).
 *
 * The `config` singleton is the source of truth. Prefer importing `{config}`
 * and reading `config.<field>`. Dedicated exports remain only for genuine
 * helpers/derived values (e.g. brandNotebook, SIGNIN_PATH).
 */

const DEFAULT_MAXIMUM_LONG_LIVED_DURATION_DAYS = 90;
/** Default duration-hint chips for long-lived tokens; clamped to the max. */
const DEFAULT_HINTS = [1, 5, 10, 30, 90, 365];

/**
 * When the directory lists a notebook as archived (or id absent), the mobile app
 * may drop local DBs after sync (`allow`) or keep them closed but recoverable (`never`).
 * Set via VITE_FORCE_REMOTE_DELETION; must match the Field Mark app build for accurate web copy.
 */
export type ForceRemoteDeletionMode = 'allow' | 'never';

const MAP_STYLESHEET_NAMES = [
  'basic',
  'openstreetmap',
  'osm-bright',
  'toner',
] as const satisfies readonly MapStylesheetNameType[];

// ---------------------------------------------------------------------------
// Single-pass env schema: validate/coerce, strip unknowns, rename to config.
// ---------------------------------------------------------------------------

const EnvSchema = z
  .object({
    /**
     * Singular display name for notebooks (defaults to `'project'` on web).
     * Plural / capitalised forms are derived — same rules as the Field Mark app.
     */
    VITE_NOTEBOOK_NAME: configHelpers.stringDefault('project'),
    /** Browser tab / chrome title for the Control Centre. */
    VITE_WEBSITE_TITLE: configHelpers.stringDefault('Control Centre'),
    /** Product display name (required). */
    VITE_APP_NAME: z
      .string({error: 'Missing required env variable VITE_APP_NAME'})
      .min(1, 'Missing required env variable VITE_APP_NAME'),
    /** Optional short name; falls back to VITE_APP_NAME when blank. */
    VITE_APP_SHORT_NAME: z.string().optional(),
    /** Public Control Centre base URL (required). */
    VITE_WEB_URL: z
      .string({error: 'Missing required env variable VITE_WEB_URL'})
      .min(1, 'Missing required env variable VITE_WEB_URL'),
    /** Public Conductor / API base URL (required). */
    VITE_API_URL: z
      .string({error: 'Missing required env variable VITE_API_URL'})
      .min(1, 'Missing required env variable VITE_API_URL'),
    /** Public Field Mark app base URL (required). */
    VITE_APP_URL: z
      .string({error: 'Missing required env variable VITE_APP_URL'})
      .min(1, 'Missing required env variable VITE_APP_URL'),
    /** Optional docs / help site URL. */
    VITE_DOCS_URL: configHelpers.stringDefault(''),
    /** Theme identifier applied to the Control Centre chrome. */
    VITE_APP_THEME: configHelpers.stringDefault('default'),
    /** Enables developer-only UI when exactly `'true'`. */
    VITE_DEVELOPER_MODE: z
      .string()
      .optional()
      .transform(v => v === 'true'),
    /**
     * Comma-separated team roles to hide from team-role dropdowns. Invalid
     * role names are ignored with a warning.
     */
    VITE_EXCLUDED_TEAM_ROLES: z
      .string()
      .optional()
      .transform(v => {
        const validTeamRoles = new Set(
          resourceRoles[Resource.TEAM].map(r => r.role as string)
        );
        const requested =
          v
            ?.split(',')
            .map(s => s.trim())
            .filter(Boolean) ?? [];
        const invalid = requested.filter(r => !validTeamRoles.has(r));
        if (invalid.length > 0) {
          console.warn(
            `VITE_EXCLUDED_TEAM_ROLES contains values that are not team roles and will be ignored: ${invalid.join(', ')}`
          );
        }
        return new Set(requested.filter(r => validTeamRoles.has(r)));
      }),
    /**
     * When the directory lists a notebook as archived (or id absent), the
     * mobile app may drop local DBs after sync (`allow`) or keep them closed
     * but recoverable (`never`). Must match the Field Mark app build for
     * accurate web copy.
     */
    VITE_FORCE_REMOTE_DELETION: configHelpers.enumDefault(
      ['allow', 'never'] as const satisfies readonly ForceRemoteDeletionMode[],
      'never'
    ),
    /**
     * When true, the mobile app destroys local Pouch data on manual notebook
     * deactivation. Baked at build time; must match the Field Mark app build
     * for accurate copy.
     */
    VITE_DELETE_ON_DEACTIVATION: configHelpers.boolWithDefault(false),
    /**
     * Maximum duration in days for long-lived tokens. Use `"unlimited"` /
     * `"infinite"` / `"none"` for no cap; blank falls back to the default.
     */
    VITE_MAXIMUM_LONG_LIVED_DURATION_DAYS: z
      .string()
      .optional()
      .transform((v): number | undefined => {
        if (configHelpers.isBlank(v)) {
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
    /**
     * CSV of integer duration hints (days) for the long-lived token UI.
     * Clamped to the maximum expiry window when one is set.
     */
    VITE_LONG_LIVED_TOKEN_DURATION_HINTS: z.string().optional(),
    /**
     * Map tile source (see app map `tile_source.ts`). Pair with
     * VITE_MAP_SOURCE_KEY when the provider needs an API key.
     */
    VITE_MAP_SOURCE: configHelpers.stringDefault('osm'),
    /** Optional satellite imagery provider (`esri` or `maptiler`). */
    VITE_SATELLITE_SOURCE: configHelpers.optionalEnum(['esri', 'maptiler']),
    /** API key for the configured map source (when required). */
    VITE_MAP_SOURCE_KEY: configHelpers.stringDefault(''),
    /** Map stylesheet name (`basic`, `openstreetmap`, `osm-bright`, `toner`). */
    VITE_MAP_STYLE: configHelpers.enumDefault(
      [...MAP_STYLESHEET_NAMES],
      'basic'
    ),
    /** Bugsnag API key; unset disables error reporting. */
    VITE_BUGSNAG_API_KEY: z
      .string()
      .optional()
      .transform((v): string | undefined => {
        if (configHelpers.isBlank(v)) {
          console.log('VITE_BUGSNAG_API_KEY not set, error reporting disabled');
          return undefined;
        }
        return v;
      }),
  })
  .strip()
  .transform(env => {
    const notebookName = env.VITE_NOTEBOOK_NAME;
    const notebookNamePlural = pluralize(notebookName);

    // Duration hints for long-lived tokens (CSV of days, clamped to max)
    const maximumDays = env.VITE_MAXIMUM_LONG_LIVED_DURATION_DAYS;
    const hintsEnv = env.VITE_LONG_LIVED_TOKEN_DURATION_HINTS;
    let hints: number[];
    if (configHelpers.isBlank(hintsEnv)) {
      console.log(
        'VITE_LONG_LIVED_TOKEN_DURATION_HINTS not set, using defaults'
      );
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
    if (maximumDays !== undefined) {
      hints = hints.filter(hint => hint <= maximumDays);
      if (hints.length === 0) {
        console.warn(
          `All duration hints exceed maximum duration of ${maximumDays} days. Adding maximum as hint.`
        );
        hints = [maximumDays];
      }
    }
    // Sort ascending and de-dupe
    const longLivedTokenDurationHints = [...new Set(hints)].sort(
      (a, b) => a - b
    );

    const webUrl = env.VITE_WEB_URL;

    return {
      notebookName,
      websiteTitle: env.VITE_WEBSITE_TITLE,
      docsUrl: env.VITE_DOCS_URL,
      appTheme: env.VITE_APP_THEME,
      developerMode: env.VITE_DEVELOPER_MODE,
      forceRemoteDeletion: env.VITE_FORCE_REMOTE_DELETION,
      deleteOnDeactivation: env.VITE_DELETE_ON_DEACTIVATION,
      maximumLongLivedDurationDays: maximumDays,
      mapSource: env.VITE_MAP_SOURCE,
      mapSourceKey: env.VITE_MAP_SOURCE_KEY,
      mapStyle: env.VITE_MAP_STYLE,
      satelliteSource: env.VITE_SATELLITE_SOURCE,
      bugsnagApiKey: env.VITE_BUGSNAG_API_KEY,
      appName: env.VITE_APP_NAME,
      appShortName: configHelpers.isBlank(env.VITE_APP_SHORT_NAME)
        ? env.VITE_APP_NAME
        : env.VITE_APP_SHORT_NAME,
      webUrl,
      /** Control Centre home (`/` redirects to `/teams`). */
      webHomeUrl: `${webUrl.replace(/\/$/, '')}/`,
      apiUrl: env.VITE_API_URL,
      appUrl: env.VITE_APP_URL,
      /** Team roles hidden from team-role dropdowns. */
      excludedTeamRoles: env.VITE_EXCLUDED_TEAM_ROLES,
      longLivedTokenDurationHints,
      notebookNameCapitalized: capitalize(notebookName),
      /** Lowercase plural, from `VITE_NOTEBOOK_NAME` (same rules as the Field Mark app). */
      notebookNamePlural,
      /** Plural with first letter capitalised — use for headings and labels. */
      notebookNamePluralCapitalized: capitalize(notebookNamePlural),
    };
  });

/**
 * The singleton Control Centre configuration object. Prefer reading values
 * from here; the named exports below derive from it.
 *
 * Explicit static `import.meta.env.VITE_*` accesses are required so Vite
 * performs build-time string replacement for each variable.
 */
export const config = EnvSchema.parse({
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

export type Config = typeof config;

// ---------------------------------------------------------------------------
// Derived helpers and non-env constants. Simple env values live on `config`
// (import `{config}` and read `config.<field>`); the items below are genuine
// helpers/derived values and remain dedicated exports.
// ---------------------------------------------------------------------------

/** Replace `{notebook}` / `{notebooks}` placeholders with the deployment's notebook name. */
export const brandNotebook = (text: string): string =>
  text
    .replaceAll('{notebooks}', config.notebookNamePlural)
    .replaceAll('{notebook}', config.notebookName);

export const SIGNIN_PATH = `${config.apiUrl}/login?redirect=${config.webUrl}`;

// this is where the /app will accept a ?token query string
export const APP_TOKEN_RETURN_PATH = config.appUrl + '/auth-return';

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
  return `${config.apiUrl}/register?redirect=${redirect}&inviteId=${inviteId}`;
}

// Token refresh interval (every 3 minutes)
export const REFRESH_INTERVAL = 3 * 60 * 1000;

export const INVITE_TOKEN_HINTS = DEFAULT_HINTS;

/** Help link for long-lived token documentation. */
export const LONG_LIVED_TOKEN_HELP_LINK =
  'https://github.com/FAIMS/FAIMS3/blob/main/docs/developer/docs/source/markdown/Long-lived-tokens.md';

/** Build the map configuration object consumed by map UI components. */
export function getMapConfig(): MapConfig {
  return {
    mapSource: config.mapSource,
    mapSourceKey: config.mapSourceKey,
    mapStyle: config.mapStyle,
    satelliteSource: config.satelliteSource,
  };
}

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
