// SPDX-License-Identifier: Apache-2.0
import {z} from 'zod';

/**
 * Shared domain enums, operational defaults, and cross-field helpers used by
 * both Layer 1 (`BuildConfigSchema` / core.json) and Layer 2 (client ENV
 * schemas). Keep these here so JSON and env parsers cannot drift on meaning.
 */

/** Visual theme name (`default`, `fieldmark`, `bssTheme`, or a custom string). */
export const ThemeSchema = z.string();
/** Notebook listing layout: tabbed vs heading sections. */
export const NotebookListTypeSchema = z.enum(['tabs', 'headings']);
/** Record navigation chrome: none, or breadcrumbs. */
export const NavigationStyleSchema = z.enum(['none', 'breadcrumbs']);
/** Tile provider. Blank disables the map. OSM cannot serve offline downloads. */
export const MapSourceSchema = z.enum(['osm', 'maptiler', '']);
/** MapLibre stylesheet baked into `@faims3/forms`. */
export const MapStyleSchema = z.enum([
  'basic',
  'openstreetmap',
  'osm-bright',
  'toner',
]);
/** Optional satellite overlay source. */
export const SatelliteSourceSchema = z.enum(['esri', 'maptiler']);
/** Address-autosuggest provider. `none` is manual entry only. */
export const AutosuggestSourceSchema = z.enum(['none', 'mapbox', 'maptiler']);
/** After archive/removal: `allow` destroys local DBs; `never` only closes them. */
export const ForceRemoteDeletionSchema = z.enum(['allow', 'never']);
/** Where the API loads JWT signing keys: on-disk PEM, env PEM, or AWS SM. */
export const KeySourceSchema = z.enum(['FILE', 'ENV', 'AWS_SM']);
/** What to do with an SSO login that matches no existing user. */
export const ProvisionSsoUsersPolicySchema = z.enum([
  'own-team',
  'general-user',
  'reject',
]);
/** Outbound email backend. `MOCK` logs; `SMTP` requires host/user/password. */
export const EmailServiceTypeSchema = z.enum(['SMTP', 'MOCK']);
/** SameSite attribute on notebook-export download cookies. */
export const DownloadCookieSameSiteSchema = z.enum(['lax', 'strict', 'none']);

/** Visual theme name (same values as {@link ThemeSchema}). */
export type Theme = z.infer<typeof ThemeSchema>;
/** Notebook listing layout (same values as {@link NotebookListTypeSchema}). */
export type NotebookListType = z.infer<typeof NotebookListTypeSchema>;
/** Record navigation chrome (same values as {@link NavigationStyleSchema}). */
export type NavigationStyle = z.infer<typeof NavigationStyleSchema>;
/** Tile provider (same values as {@link MapSourceSchema}). */
export type MapSource = z.infer<typeof MapSourceSchema>;
/** MapLibre stylesheet name (same values as {@link MapStyleSchema}). */
export type MapStyle = z.infer<typeof MapStyleSchema>;
/** Optional satellite overlay (same values as {@link SatelliteSourceSchema}). */
export type SatelliteSource = z.infer<typeof SatelliteSourceSchema>;
/** Address-autosuggest provider (same values as {@link AutosuggestSourceSchema}). */
export type AutosuggestSource = z.infer<typeof AutosuggestSourceSchema>;
/** Local-DB cleanup after archive (same values as {@link ForceRemoteDeletionSchema}). */
export type ForceRemoteDeletion = z.infer<typeof ForceRemoteDeletionSchema>;
/** JWT signing-key source (same values as {@link KeySourceSchema}). */
export type KeySource = z.infer<typeof KeySourceSchema>;
/** SSO unmatched-user policy (same values as {@link ProvisionSsoUsersPolicySchema}). */
export type ProvisionSsoUsersPolicy = z.infer<
  typeof ProvisionSsoUsersPolicySchema
>;
/** Outbound email backend (same values as {@link EmailServiceTypeSchema}). */
export type EmailServiceType = z.infer<typeof EmailServiceTypeSchema>;
/** Export-cookie SameSite (same values as {@link DownloadCookieSameSiteSchema}). */
export type DownloadCookieSameSite = z.infer<
  typeof DownloadCookieSameSiteSchema
>;

/**
 * Operational defaults that are genuinely safe to apply when a field is
 * omitted. Environment identity, URLs, and credentials do NOT live here.
 */
export const SHARED_DEFAULTS = {
  /** PouchDB changes-feed page size. */
  pouchBatchSize: 10,
  /** Max concurrent PouchDB batch requests. */
  pouchBatchesLimit: 10,
  /** Record count at which activation defaults to push-only sync. */
  syncPushOnlyRecordThreshold: 500,
  /** How often the app/web try to refresh an access token (ms). */
  tokenRefreshIntervalMs: 15000,
  /** Skip a refresh request if the token still has this much life (ms). */
  tokenRefreshWindowMs: 60000,
  /** Delay after boot before showing the "please sign in" banner (ms). */
  loginBannerGraceMs: 10000,
  /** JWT access-token lifetime. */
  accessTokenExpiryMinutes: 5,
  /** JWT refresh-token lifetime (2 days). */
  refreshTokenExpiryMinutes: 2880,
  /** Impersonation session lifetime. */
  impersonationSessionExpiryMinutes: 60,
  /** Email verification / reset code lifetime. */
  emailCodeExpiryMinutes: 30,
  /** Cap on long-lived token duration chips (days). */
  maximumLongLivedDurationDays: 90,
  /** Express IP rate-limiter window (10 min). */
  rateLimiterWindowMs: 600000,
  /** Requests allowed per IP rate-limiter window. */
  rateLimiterPerWindow: 1000,
  /** Notebook-export limiter window (10 min). */
  exportRateLimiterWindowMs: 600000,
  /** Export requests allowed per window. */
  exportRateLimiterPerWindow: 20,
  /** Age of a stuck `running` migration lock before it is stolen (30 min). */
  startupMigrationLockTimeoutMs: 1800000,
  /** Max uploaded design JSON size in the designer. */
  maxDesignFileSizeMb: 10,
  /** Default page size for hydrated-record API listings. */
  recordsHydratedPageLimit: 150,
  /** Hard ceiling applied to `recordsHydratedPageLimit`. */
  recordsHydratedPageLimitMax: 500,
  /** Express JSON body parser limit. */
  jsonBodyLimit: '25mb',
  /** Express urlencoded body parser limit. */
  urlencodedBodyLimit: '1mb',
  /** Max restore-upload payload (1 GiB). */
  restoreUploadMaxBytes: 1073741824,
  /** SMTP port when EMAIL_SERVICE_TYPE=SMTP. */
  smtpPort: 587,
  /** SMTP connection-cache TTL. */
  smtpCacheExpirySeconds: 300,
  /** Published Conductor port (docker / local). AWS CDK overrides. */
  conductorExternalPort: 8080,
  /** Port the API process binds. AWS CDK overrides. */
  conductorInternalPort: 8080,
  /** Published CouchDB port (docker / local). */
  couchdbExternalPort: 5984,
  /** Default long-lived token duration chips (days). */
  defaultLongLivedHints: [1, 5, 10, 30, 90, 365] as readonly number[],
} as const;

/** Default chip list for long-lived token duration; clamped to the max days. */
export const DEFAULT_LONG_LIVED_TOKEN_DURATION_HINTS: readonly number[] =
  SHARED_DEFAULTS.defaultLongLivedHints;

/** Inputs shared by map + autosuggest key validation. */
export type MapAutosuggestFields = {
  mapSource: string;
  mapSourceKey: string;
  autosuggestSource: string;
  autosuggestMapboxKey: string;
  autosuggestMapTilerKey: string;
};

/**
 * Address-autosuggest key requirements. Used by both the JSON maps group
 * and the app ENV schema so the same source/key pairing is enforced.
 */
export function validateMapAndAutosuggestKeys(
  data: MapAutosuggestFields,
  ctx: z.RefinementCtx,
  paths: {mapbox: Array<string | number>; tiler: Array<string | number>} = {
    mapbox: ['autosuggestMapboxKey'],
    tiler: ['autosuggestMapTilerKey'],
  }
) {
  if (
    data.autosuggestSource === 'mapbox' &&
    !data.autosuggestMapboxKey.trim()
  ) {
    ctx.addIssue({
      code: 'custom',
      path: paths.mapbox,
      message:
        'When autosuggestSource is mapbox, autosuggestMapboxKey is required.',
    });
  }
  if (data.autosuggestSource === 'maptiler') {
    const hasTilerKey = !!data.autosuggestMapTilerKey.trim();
    const fallsBackToMapKey =
      data.mapSource === 'maptiler' && !!data.mapSourceKey.trim();
    if (!hasTilerKey && !fallsBackToMapKey) {
      ctx.addIssue({
        code: 'custom',
        path: paths.tiler,
        message:
          'When autosuggestSource is maptiler, either autosuggestMapTilerKey must be set or mapSource must be "maptiler" with mapSourceKey set (the map tile key will be used for autosuggest).',
      });
    }
  }
}

/** Dedicated MapTiler autosuggest key, else the map-tile key when source is maptiler. */
export function resolveMapTilerApiKey(
  data: MapAutosuggestFields
): string | undefined {
  const dedicated = data.autosuggestMapTilerKey.trim();
  if (dedicated) return dedicated;
  if (data.mapSource === 'maptiler' && data.mapSourceKey.trim()) {
    return data.mapSourceKey.trim();
  }
  return undefined;
}

/** OSM forbids bulk tile download; force `offlineMaps` off for that source. */
export function clampOfflineMaps(
  mapSource: string,
  offlineMaps: boolean
): boolean {
  return mapSource === 'osm' ? false : offlineMaps;
}

/** Pair used by {@link validateMigrationLock}. */
export type MigrationLockFields = {
  disableMigrateOnStartup: boolean;
  startupMigrationLockEnabled?: boolean;
};

/**
 * The clustered startup-migration lock cannot be on when boot migrate is
 * skipped — there is nothing to lock.
 */
export function validateMigrationLock(
  data: MigrationLockFields,
  ctx: z.RefinementCtx,
  path: Array<string | number> = ['startupMigrationLockEnabled']
) {
  if (data.disableMigrateOnStartup && data.startupMigrationLockEnabled) {
    ctx.addIssue({
      code: 'custom',
      path,
      message:
        'startupMigrationLockEnabled cannot be true when disableMigrateOnStartup is true. There is nothing to lock if API boot skips migrate. Omit startupMigrationLockEnabled or set it false.',
    });
  }
}

/** Skip-migrate forces the lock off; otherwise the explicit/omitted value is kept. */
export function resolveStartupMigrationLockEnabled(
  disableMigrateOnStartup: boolean,
  startupMigrationLockEnabled: boolean | undefined
): boolean | undefined {
  return disableMigrateOnStartup ? false : startupMigrationLockEnabled;
}

/**
 * Clamp, dedupe, and sort duration chips. Empty/`undefined` uses the default
 * list. A numeric cap drops chips above it (or becomes `[maxDays]` if none remain).
 */
export function resolveLongLivedDurationHints(
  provided: number[] | undefined,
  maxDays: number | 'unlimited'
): number[] {
  const sourceHints =
    provided && provided.length > 0
      ? provided
      : [...DEFAULT_LONG_LIVED_TOKEN_DURATION_HINTS];
  if (typeof maxDays === 'number') {
    let hints = sourceHints.filter(hint => hint <= maxDays);
    if (hints.length === 0) hints = [maxDays];
    return [...new Set(hints)].sort((a, b) => a - b);
  }
  if (!provided || provided.length === 0) {
    return [...DEFAULT_LONG_LIVED_TOKEN_DURATION_HINTS];
  }
  return [...sourceHints];
}

/** Display forms of the notebook noun used in UI copy. */
export type NotebookNames = {
  notebookName: string;
  notebookNamePlural: string;
  notebookNameCapitalized: string;
  notebookNamePluralCapitalized: string;
};

/** First-letter capitalisation for notebook display names. */
function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Regular English plural for notebook display names (`survey` → `surveys`).
 * Irregulars are not expected for this field.
 */
export function deriveNotebookNames(singular: string): NotebookNames {
  const notebookName = singular;
  const notebookNamePlural = /s$/i.test(singular) ? singular : `${singular}s`;
  return {
    notebookName,
    notebookNamePlural,
    notebookNameCapitalized: capitalize(notebookName),
    notebookNamePluralCapitalized: capitalize(notebookNamePlural),
  };
}

/** Map object consumed by `@faims3/forms` map UI (`MapConfig`). */
export type MapConfigShape = {
  mapSource: MapSource;
  mapSourceKey: string;
  mapStyle: MapStyle;
  satelliteSource?: SatelliteSource;
};

/** Build a `MapConfig`-compatible object; omits unset satellite source. */
export function buildMapConfig(input: {
  mapSource: MapSource;
  mapSourceKey: string;
  mapStyle: MapStyle;
  satelliteSource?: SatelliteSource;
}): MapConfigShape {
  const mapConfig: MapConfigShape = {
    mapSource: input.mapSource,
    mapSourceKey: input.mapSourceKey,
    mapStyle: input.mapStyle,
  };
  if (input.satelliteSource) {
    mapConfig.satelliteSource = input.satelliteSource;
  }
  return mapConfig;
}
