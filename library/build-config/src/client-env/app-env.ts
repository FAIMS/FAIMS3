// SPDX-License-Identifier: Apache-2.0
/**
 * Layer 2 — mobile app / PWA ENV schema.
 *
 * Required: VITE_CONDUCTOR_URL, VITE_APP_NAME, VITE_APP_ID.
 * Conditionally required: VITE_AUTOSUGGEST_MAPBOX_KEY (source=mapbox);
 * MapTiler key or map-tile key when source=maptiler.
 */
import {z} from 'zod';
import {
  boolWithDefault,
  enumWithDefault,
  intWithDefault,
  optionalEnum,
  optionalEnvString,
  parseBugsnagKey,
  requiredEnvString,
  requiredUrlCsv,
  resolveInjectedAppVersion,
  sanitizeCommitVersion,
  stringWithDefault,
  UpperCsvSchema,
} from '../env-coercion.js';
import {
  AutosuggestSourceSchema,
  ForceRemoteDeletionSchema,
  MapSourceSchema,
  MapStyleSchema,
  NavigationStyleSchema,
  NotebookListTypeSchema,
  SatelliteSourceSchema,
  SHARED_DEFAULTS,
  buildMapConfig,
  clampOfflineMaps,
  deriveNotebookNames,
  resolveMapTilerApiKey,
  validateMapAndAutosuggestKeys,
  type AutosuggestSource,
  type ForceRemoteDeletion,
  type MapConfigShape,
  type MapSource,
  type MapStyle,
  type NavigationStyle,
  type NotebookListType,
  type SatelliteSource,
} from '../shared-schemas.js';

/** Paired directory listing credentials; only set when both env values are present. */
export type AppDirectoryAuth = {username: string; password: string};

/** Typed app runtime config produced by {@link parseAppEnv}. */
export type AppRuntimeConfig = {
  debugPouchdb: boolean;
  debugApp: boolean;
  showPouchdbBrowser: boolean;
  showWipe: boolean;
  showNewNotebook: boolean;
  showRecordSummaryCounts: boolean;
  showStatusTab: boolean;
  pouchBatchSize: number;
  pouchBatchesLimit: number;
  syncPushOnlyRecordThreshold: number;
  notebookListType: NotebookListType;
  notebookName: string;
  notebookNameCapitalized: string;
  notebookNamePlural: string;
  notebookNamePluralCapitalized: string;
  /** Reverse-domain app id (store listing / deep-link scheme). */
  appId: string;
  appName: string;
  /** Banner heading; falls back to appName. */
  headingAppName: string;
  privacyPolicyUrl: string;
  /** Empty string hides the contact link. */
  contactUrl: string;
  supportEmail: string;
  theme: string;
  clusterAdminGroupName: string;
  tokenRefreshIntervalMs: number;
  tokenRefreshWindowMs: number;
  loginBannerGraceMs: number;
  ignoreTokenExp: boolean;
  mapSource: MapSource;
  mapSourceKey: string;
  mapStyle: MapStyle;
  satelliteSource?: SatelliteSource;
  navigationStyle: NavigationStyle;
  migrateOldDatabases: boolean;
  forceRemoteDeletion: ForceRemoteDeletion;
  deleteOnDeactivation: boolean;
  attachmentServiceType: string;
  attachmentDocumentIdPrefix?: string;
  bugsnagKey?: string;
  mapboxAccessToken?: string;
  mapboxAddressCountry: string[];
  maptilerAddressCountry: string[];
  autosuggestSource: AutosuggestSource;
  /** Conductor URLs the app may authenticate against (from VITE_CONDUCTOR_URL). */
  conductorUrls: string[];
  directoryAuth?: AppDirectoryAuth;
  runningUnderTest: boolean;
  maptilerApiKey?: string;
  /** Forced off when mapSource is osm. */
  offlineMaps: boolean;
  appVersion: string;
  commitHash?: string;
  mapConfig: MapConfigShape;
};

/** App `import.meta.env` schema. */
export const AppEnvSchema = z
  .object({
    /** One or more Conductor URLs (CSV). Required. */
    VITE_CONDUCTOR_URL: requiredUrlCsv('VITE_CONDUCTOR_URL'),
    VITE_APP_NAME: requiredEnvString('VITE_APP_NAME'),
    VITE_APP_ID: requiredEnvString('VITE_APP_ID'),
    VITE_HEADING_APP_NAME: optionalEnvString(),
    VITE_THEME: stringWithDefault('default'),
    VITE_CLUSTER_ADMIN_GROUP_NAME: stringWithDefault('cluster-admin'),
    /** Lowercase singular notebook noun. */
    VITE_NOTEBOOK_NAME: stringWithDefault('notebook'),
    VITE_NOTEBOOK_LIST_TYPE: enumWithDefault(NotebookListTypeSchema, 'tabs'),
    VITE_NAVIGATION: enumWithDefault(NavigationStyleSchema, 'none'),
    VITE_SUPPORT_EMAIL: stringWithDefault('support@fieldmark.au'),
    VITE_APP_PRIVACY_POLICY_URL: stringWithDefault(
      'https://fieldnote.au/privacy'
    ),
    VITE_APP_CONTACT_URL: optionalEnvString(),
    VITE_DIRECTORY_USERNAME: optionalEnvString(),
    VITE_DIRECTORY_PASSWORD: optionalEnvString(),
    VITE_MAP_SOURCE: enumWithDefault(MapSourceSchema, 'osm'),
    VITE_MAP_SOURCE_KEY: stringWithDefault(''),
    VITE_MAP_STYLE: enumWithDefault(MapStyleSchema, 'basic'),
    VITE_SATELLITE_SOURCE: optionalEnum(SatelliteSourceSchema),
    VITE_OFFLINE_MAPS: boolWithDefault(true),
    VITE_AUTOSUGGEST_SOURCE: enumWithDefault(AutosuggestSourceSchema, 'none'),
    VITE_AUTOSUGGEST_MAPBOX_KEY: optionalEnvString(),
    VITE_AUTOSUGGEST_MAPTILER_KEY: optionalEnvString(),
    /** ISO 3166-1 alpha-2 CSV. */
    VITE_MAPBOX_ADDRESS_COUNTRY: stringWithDefault('AU'),
    VITE_MAPTILER_ADDRESS_COUNTRY: stringWithDefault('AU'),
    VITE_POUCH_BATCH_SIZE: intWithDefault(SHARED_DEFAULTS.pouchBatchSize),
    VITE_POUCH_BATCHES_LIMIT: intWithDefault(SHARED_DEFAULTS.pouchBatchesLimit),
    VITE_SYNC_PUSH_ONLY_RECORD_THRESHOLD: intWithDefault(
      SHARED_DEFAULTS.syncPushOnlyRecordThreshold
    ),
    VITE_TOKEN_REFRESH_INTERVAL_MS: intWithDefault(
      SHARED_DEFAULTS.tokenRefreshIntervalMs
    ),
    VITE_TOKEN_REFRESH_WINDOW_MS: intWithDefault(
      SHARED_DEFAULTS.tokenRefreshWindowMs
    ),
    VITE_LOGIN_BANNER_GRACE_MS: intWithDefault(
      SHARED_DEFAULTS.loginBannerGraceMs
    ),
    VITE_IGNORE_TOKEN_EXP: boolWithDefault(false),
    /** `allow` destroys local DBs after archive; `never` only closes them. */
    VITE_FORCE_REMOTE_DELETION: enumWithDefault(
      ForceRemoteDeletionSchema,
      'never'
    ),
    /** Wipe local Pouch data on manual deactivate. */
    VITE_DELETE_ON_DEACTIVATION: boolWithDefault(false),
    VITE_ATTACHMENT_SERVICE_TYPE: stringWithDefault('COUCH'),
    VITE_ATTACHMENT_DOCUMENT_ID_PREFIX: optionalEnvString(),
    VITE_MIGRATE_OLD_DATABASES: boolWithDefault(false),
    VITE_SHOW_WIPE: boolWithDefault(true),
    VITE_SHOW_POUCHDB_BROWSER: boolWithDefault(true),
    VITE_SHOW_NEW_NOTEBOOK: boolWithDefault(true),
    VITE_SHOW_RECORD_SUMMARY_COUNTS: boolWithDefault(true),
    VITE_SHOW_STATUS_TAB: boolWithDefault(true),
    VITE_DEBUG_APP: boolWithDefault(false),
    VITE_DEBUG_POUCHDB: boolWithDefault(false),
    VITE_COMMIT_VERSION: optionalEnvString(),
    VITE_BUGSNAG_KEY: optionalEnvString(),
    /** Used only to detect `runningUnderTest` (`test`). */
    NODE_ENV: optionalEnvString(),
  })
  .strip()
  .superRefine((data, ctx) => {
    validateMapAndAutosuggestKeys(
      {
        mapSource: data.VITE_MAP_SOURCE,
        mapSourceKey: data.VITE_MAP_SOURCE_KEY,
        autosuggestSource: data.VITE_AUTOSUGGEST_SOURCE,
        autosuggestMapboxKey: data.VITE_AUTOSUGGEST_MAPBOX_KEY ?? '',
        autosuggestMapTilerKey: data.VITE_AUTOSUGGEST_MAPTILER_KEY ?? '',
      },
      ctx,
      {
        mapbox: ['VITE_AUTOSUGGEST_MAPBOX_KEY'],
        tiler: ['VITE_AUTOSUGGEST_MAPTILER_KEY'],
      }
    );
  });

export type AppEnv = z.infer<typeof AppEnvSchema>;

export interface ParseAppEnvOptions {
  /** Vite `define` `__APP_VERSION__` (package.json version). */
  appVersion?: string;
  runningUnderTest?: boolean;
}

/**
 * Parse the mobile-app / PWA Vite environment into a typed runtime config.
 * Conductor URL, app name, and app id are required.
 */
export function parseAppEnv(
  raw: Record<string, unknown>,
  options: ParseAppEnvOptions = {}
): AppRuntimeConfig {
  const env = AppEnvSchema.parse(raw);
  const names = deriveNotebookNames(env.VITE_NOTEBOOK_NAME);
  const maps = {
    mapSource: env.VITE_MAP_SOURCE,
    mapSourceKey: env.VITE_MAP_SOURCE_KEY,
    autosuggestSource: env.VITE_AUTOSUGGEST_SOURCE,
    autosuggestMapboxKey: env.VITE_AUTOSUGGEST_MAPBOX_KEY ?? '',
    autosuggestMapTilerKey: env.VITE_AUTOSUGGEST_MAPTILER_KEY ?? '',
  };

  let directoryAuth: AppDirectoryAuth | undefined;
  if (env.VITE_DIRECTORY_USERNAME && env.VITE_DIRECTORY_PASSWORD) {
    directoryAuth = {
      username: env.VITE_DIRECTORY_USERNAME,
      password: env.VITE_DIRECTORY_PASSWORD,
    };
  }

  return {
    debugPouchdb: env.VITE_DEBUG_POUCHDB,
    debugApp: env.VITE_DEBUG_APP,
    showPouchdbBrowser: env.VITE_SHOW_POUCHDB_BROWSER,
    showWipe: env.VITE_SHOW_WIPE,
    showNewNotebook: env.VITE_SHOW_NEW_NOTEBOOK,
    showRecordSummaryCounts: env.VITE_SHOW_RECORD_SUMMARY_COUNTS,
    showStatusTab: env.VITE_SHOW_STATUS_TAB,
    pouchBatchSize: env.VITE_POUCH_BATCH_SIZE,
    pouchBatchesLimit: env.VITE_POUCH_BATCHES_LIMIT,
    syncPushOnlyRecordThreshold: env.VITE_SYNC_PUSH_ONLY_RECORD_THRESHOLD,
    notebookListType: env.VITE_NOTEBOOK_LIST_TYPE,
    ...names,
    appId: env.VITE_APP_ID,
    appName: env.VITE_APP_NAME,
    headingAppName: env.VITE_HEADING_APP_NAME || env.VITE_APP_NAME,
    privacyPolicyUrl: env.VITE_APP_PRIVACY_POLICY_URL,
    contactUrl: env.VITE_APP_CONTACT_URL ?? '',
    supportEmail: env.VITE_SUPPORT_EMAIL,
    theme: env.VITE_THEME,
    clusterAdminGroupName: env.VITE_CLUSTER_ADMIN_GROUP_NAME,
    tokenRefreshIntervalMs: env.VITE_TOKEN_REFRESH_INTERVAL_MS,
    tokenRefreshWindowMs: env.VITE_TOKEN_REFRESH_WINDOW_MS,
    loginBannerGraceMs: env.VITE_LOGIN_BANNER_GRACE_MS,
    ignoreTokenExp: env.VITE_IGNORE_TOKEN_EXP,
    mapSource: env.VITE_MAP_SOURCE,
    mapSourceKey: env.VITE_MAP_SOURCE_KEY,
    mapStyle: env.VITE_MAP_STYLE,
    satelliteSource: env.VITE_SATELLITE_SOURCE,
    navigationStyle: env.VITE_NAVIGATION,
    migrateOldDatabases: env.VITE_MIGRATE_OLD_DATABASES,
    forceRemoteDeletion: env.VITE_FORCE_REMOTE_DELETION,
    deleteOnDeactivation: env.VITE_DELETE_ON_DEACTIVATION,
    attachmentServiceType: env.VITE_ATTACHMENT_SERVICE_TYPE,
    attachmentDocumentIdPrefix: env.VITE_ATTACHMENT_DOCUMENT_ID_PREFIX,
    bugsnagKey: parseBugsnagKey(env.VITE_BUGSNAG_KEY),
    mapboxAccessToken: env.VITE_AUTOSUGGEST_MAPBOX_KEY,
    mapboxAddressCountry: UpperCsvSchema.parse(env.VITE_MAPBOX_ADDRESS_COUNTRY),
    maptilerAddressCountry: UpperCsvSchema.parse(
      env.VITE_MAPTILER_ADDRESS_COUNTRY
    ),
    autosuggestSource: env.VITE_AUTOSUGGEST_SOURCE,
    conductorUrls: env.VITE_CONDUCTOR_URL,
    directoryAuth,
    runningUnderTest: options.runningUnderTest ?? env.NODE_ENV === 'test',
    maptilerApiKey: resolveMapTilerApiKey(maps),
    offlineMaps: clampOfflineMaps(env.VITE_MAP_SOURCE, env.VITE_OFFLINE_MAPS),
    appVersion: resolveInjectedAppVersion(options.appVersion),
    commitHash: sanitizeCommitVersion(env.VITE_COMMIT_VERSION),
    mapConfig: buildMapConfig({
      mapSource: env.VITE_MAP_SOURCE,
      mapSourceKey: env.VITE_MAP_SOURCE_KEY,
      mapStyle: env.VITE_MAP_STYLE,
      satelliteSource: env.VITE_SATELLITE_SOURCE,
    }),
  };
}
