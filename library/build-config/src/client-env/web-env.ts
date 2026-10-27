// SPDX-License-Identifier: Apache-2.0
/**
 * Layer 2 — Control Centre ENV schema.
 *
 * Required: VITE_WEB_URL, VITE_API_URL, VITE_APP_URL, VITE_APP_NAME.
 */
import {z} from 'zod';
import {
  boolWithDefault,
  enumWithDefault,
  intWithDefault,
  maxLongLivedDaysWithDefault,
  optionalEnum,
  optionalEnvString,
  OptionalCsvSchema,
  parseBugsnagKey,
  requiredEnvString,
  requiredEnvUrl,
  resolveInjectedAppVersion,
  stringWithDefault,
} from '../env-coercion.js';
import {
  DEFAULT_LONG_LIVED_TOKEN_DURATION_HINTS,
  ForceRemoteDeletionSchema,
  MapSourceSchema,
  MapStyleSchema,
  SatelliteSourceSchema,
  SHARED_DEFAULTS,
  buildMapConfig,
  deriveNotebookNames,
  resolveLongLivedDurationHints,
} from '../shared-schemas.js';

/** Control Centre `import.meta.env` schema. */
export const WebEnvSchema = z
  .object({
    /** Control Centre origin. Trailing slash is preserved. Required. */
    VITE_WEB_URL: requiredEnvUrl('VITE_WEB_URL', {stripSlash: false}),
    VITE_API_URL: requiredEnvUrl('VITE_API_URL'),
    VITE_APP_URL: requiredEnvUrl('VITE_APP_URL'),
    VITE_APP_NAME: requiredEnvString('VITE_APP_NAME'),
    VITE_APP_SHORT_NAME: optionalEnvString(),
    VITE_WEBSITE_TITLE: stringWithDefault('Control Centre'),
    VITE_NOTEBOOK_NAME: stringWithDefault('project'),
    VITE_THEME: stringWithDefault('default'),
    VITE_DEVELOPER_MODE: boolWithDefault(false),
    VITE_FORCE_REMOTE_DELETION: enumWithDefault(
      ForceRemoteDeletionSchema,
      'never'
    ),
    VITE_DELETE_ON_DEACTIVATION: boolWithDefault(false),
    VITE_MAXIMUM_LONG_LIVED_DURATION_DAYS: maxLongLivedDaysWithDefault(
      SHARED_DEFAULTS.maximumLongLivedDurationDays
    ),
    /** CSV of day-duration chips; clamped to the max. */
    VITE_LONG_LIVED_TOKEN_DURATION_HINTS: optionalEnvString(),
    VITE_MAP_SOURCE: enumWithDefault(MapSourceSchema, 'osm'),
    VITE_MAP_SOURCE_KEY: stringWithDefault(''),
    VITE_MAP_STYLE: enumWithDefault(MapStyleSchema, 'basic'),
    VITE_SATELLITE_SOURCE: optionalEnum(SatelliteSourceSchema),
    VITE_BUGSNAG_KEY: optionalEnvString(),
    VITE_DOCS_URL: optionalEnvString(),
    VITE_MAX_DESIGN_FILE_SIZE_MB: intWithDefault(
      SHARED_DEFAULTS.maxDesignFileSizeMb
    ),
    /** CSV of TEAM role ids hidden from dropdowns. */
    VITE_EXCLUDED_TEAM_ROLES: optionalEnvString(),
  })
  .strip();

/** Parsed Control Centre environment variables. */
export type WebEnv = z.infer<typeof WebEnvSchema>;

/** Options for {@link parseWebEnv}. */
export interface ParseWebEnvOptions {
  /** Vite `define` `__APP_VERSION__` (package.json version). */
  appVersion?: string;
}

/**
 * Parse the Control Centre Vite environment into a typed runtime config.
 * Web / API / app URLs and the app name are required.
 */
export function parseWebEnv(
  raw: Record<string, unknown>,
  options: ParseWebEnvOptions = {}
) {
  const env = WebEnvSchema.parse(raw);
  const names = deriveNotebookNames(env.VITE_NOTEBOOK_NAME);
  const providedHints = env.VITE_LONG_LIVED_TOKEN_DURATION_HINTS
    ? OptionalCsvSchema.parse(env.VITE_LONG_LIVED_TOKEN_DURATION_HINTS)
        .map(item => Number.parseInt(item, 10))
        .filter(item => Number.isFinite(item) && item > 0)
    : [...DEFAULT_LONG_LIVED_TOKEN_DURATION_HINTS];
  const webUrl = env.VITE_WEB_URL;
  const apiUrl = env.VITE_API_URL;
  const appUrl = env.VITE_APP_URL;

  return {
    ...names,
    websiteTitle: env.VITE_WEBSITE_TITLE,
    docsUrl: env.VITE_DOCS_URL ?? '',
    theme: env.VITE_THEME,
    developerMode: env.VITE_DEVELOPER_MODE,
    forceRemoteDeletion: env.VITE_FORCE_REMOTE_DELETION,
    deleteOnDeactivation: env.VITE_DELETE_ON_DEACTIVATION,
    maximumLongLivedDurationDays:
      env.VITE_MAXIMUM_LONG_LIVED_DURATION_DAYS === 'unlimited'
        ? undefined
        : env.VITE_MAXIMUM_LONG_LIVED_DURATION_DAYS,
    longLivedTokenDurationHints: resolveLongLivedDurationHints(
      providedHints,
      env.VITE_MAXIMUM_LONG_LIVED_DURATION_DAYS
    ),
    mapSource: env.VITE_MAP_SOURCE,
    mapSourceKey: env.VITE_MAP_SOURCE_KEY,
    mapStyle: env.VITE_MAP_STYLE,
    satelliteSource: env.VITE_SATELLITE_SOURCE,
    bugsnagApiKey: parseBugsnagKey(env.VITE_BUGSNAG_KEY),
    appName: env.VITE_APP_NAME,
    appShortName: env.VITE_APP_SHORT_NAME || env.VITE_APP_NAME,
    webUrl,
    apiUrl,
    appUrl,
    excludedTeamRoles: OptionalCsvSchema.parse(
      env.VITE_EXCLUDED_TEAM_ROLES ?? ''
    ),
    maxDesignFileSizeMb: env.VITE_MAX_DESIGN_FILE_SIZE_MB,
    maxDesignFileSizeBytes: env.VITE_MAX_DESIGN_FILE_SIZE_MB * 1024 * 1024,
    webHomeUrl: `${webUrl.replace(/\/$/, '')}/`,
    signinPath: `${apiUrl}/login?redirect=${webUrl}`,
    appTokenReturnPath: `${appUrl}/auth-return`,
    mapConfig: buildMapConfig({
      mapSource: env.VITE_MAP_SOURCE,
      mapSourceKey: env.VITE_MAP_SOURCE_KEY,
      mapStyle: env.VITE_MAP_STYLE,
      satelliteSource: env.VITE_SATELLITE_SOURCE,
    }),
    appVersion: resolveInjectedAppVersion(options.appVersion),
  };
}

/** Typed Control Centre runtime config produced by {@link parseWebEnv}. */
export type WebRuntimeConfig = ReturnType<typeof parseWebEnv>;
