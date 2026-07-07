/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: buildconfig.ts
 * Description:
 *   This module exports the configuration of the build, including things like
 *   which server to use and whether to include test data.
 *
 *   Configuration is parsed from Vite's `import.meta.env` using a two-pass zod
 *   pipeline:
 *     - Pass one (EnvSchema) validates/narrows the raw environment into strings.
 *       The raw object is assembled with explicit static `import.meta.env.VITE_*`
 *       accesses so Vite performs its build-time replacement.
 *     - Pass two (ConfigSchema + a small amount of custom logic for derived or
 *       inter-dependent values) produces the typed `config` singleton.
 *
 *   Prefer importing `{config}` and reading `config.<field>`. Advanced surfaces
 *   (map config, address autosuggest) keep their existing functional interfaces
 *   (`getMapConfig()`, `getAddressAutosuggestService()`), sourced from `config`.
 */

import {Capacitor} from '@capacitor/core';
import {
  type IAutosuggestAddressService,
  MapboxAutosuggestAddressService,
  MapTilerAutosuggestAddressService,
  MapStylesheetNameType,
  MapConfig,
} from '@faims3/forms';
import pluralize from 'pluralize';
import {z} from 'zod';

// need to define a local logError here since logging.tsx imports this file
const logError = (err: any) => console.error(err);

// Constants

// Default conductor URL
export const DEFAULT_CONDUCTOR_URL = 'http://localhost:8154';

const TRUTHY_STRINGS = ['true', '1', 'on', 'yes'];
const FALSEY_STRINGS = ['false', '0', 'off', 'no'];

const DEFAULT_MAPBOX_ADDRESS_COUNTRY = ['AU'];

/**
 * Source for address autosuggest service. NONE disables autocomplete; MAPBOX
 * uses Mapbox Search Box API (requires VITE_AUTOSUGGEST_MAPBOX_KEY); MAPTILER
 * uses MapTiler Search and Geocoding API (VITE_AUTOSUGGEST_MAPTILER_KEY, or
 * VITE_MAP_SOURCE_KEY when map source is maptiler).
 */
export enum AutosuggestSource {
  /** No address autosuggest; AddressField uses manual entry only. */
  NONE = 'NONE',
  /** Mapbox Search Box API (suggest + retrieve). */
  MAPBOX = 'MAPBOX',
  /** MapTiler Search and Geocoding API (forward + by-id). */
  MAPTILER = 'MAPTILER',
}

export type NavigationStyleOption = 'none' | 'breadcrumbs';

/**
 * When a local notebook is archived or confirmed deleted upstream, the app may
 * drop it from the device.
 * - `allow`: stop sync and remote handles, then **destroy** the local Pouch DB
 *   (IndexedDB) so no local notebook data remains — security.
 * - `never` (default): same teardown as manual deactivate (sync off, remote and
 *   local Pouch **closed** but not destroyed), then remove from the app list so
 *   on-disk data can be recovered if needed.
 * Archived: detected via GET `/api/notebooks/:id` when absent from the active
 * directory — removed on first successful probe. Deleted/missing ids: confirmed
 * with several consecutive probes (automatic re-polls).
 * Set via VITE_FORCE_REMOTE_DELETION in .env / CDK; default is never.
 */
export type ForceRemoteDeletionMode = 'allow' | 'never';

// ---------------------------------------------------------------------------
// Pass one: read and validate the raw environment into (optional) strings.
//
// The raw object uses explicit static `import.meta.env.VITE_*` accesses so that
// Vite performs its build-time string replacement for each variable.
// ---------------------------------------------------------------------------

const EnvSchema = z.object({
  VITE_DEBUG_POUCHDB: z.string().optional(),
  VITE_DEBUG_APP: z.string().optional(),
  VITE_SHOW_POUCHDB_BROWSER: z.string().optional(),
  VITE_SHOW_WIPE: z.string().optional(),
  VITE_SHOW_NEW_NOTEBOOK: z.string().optional(),
  VITE_POUCH_BATCH_SIZE: z.string().optional(),
  VITE_POUCH_BATCHES_LIMIT: z.string().optional(),
  VITE_SYNC_PUSH_ONLY_RECORD_THRESHOLD: z.string().optional(),
  VITE_DIRECTORY_USERNAME: z.string().optional(),
  VITE_DIRECTORY_PASSWORD: z.string().optional(),
  VITE_CLUSTER_ADMIN_GROUP_NAME: z.string().optional(),
  VITE_BUGSNAG_KEY: z.string().optional(),
  VITE_CONDUCTOR_URL: z.string().optional(),
  VITE_NOTEBOOK_LIST_TYPE: z.string().optional(),
  VITE_NOTEBOOK_NAME: z.string().optional(),
  VITE_APP_ID: z.string().optional(),
  VITE_APP_NAME: z.string().optional(),
  VITE_HEADING_APP_NAME: z.string().optional(),
  VITE_APP_PRIVACY_POLICY_URL: z.string().optional(),
  VITE_APP_CONTACT_URL: z.string().optional(),
  VITE_SUPPORT_EMAIL: z.string().optional(),
  VITE_TOKEN_REFRESH_INTERVAL_MS: z.string().optional(),
  VITE_TOKEN_REFRESH_WINDOW_MS: z.string().optional(),
  VITE_LOGIN_BANNER_GRACE_MS: z.string().optional(),
  VITE_IGNORE_TOKEN_EXP: z.string().optional(),
  VITE_MAP_SOURCE: z.string().optional(),
  VITE_MAP_SOURCE_KEY: z.string().optional(),
  VITE_MAP_STYLE: z.string().optional(),
  VITE_SATELLITE_SOURCE: z.string().optional(),
  VITE_OFFLINE_MAPS: z.string().optional(),
  VITE_NAVIGATION: z.string().optional(),
  VITE_SHOW_RECORD_LINKS: z.string().optional(),
  VITE_MIGRATE_OLD_DATABASES: z.string().optional(),
  VITE_FORCE_REMOTE_DELETION: z.string().optional(),
  VITE_DELETE_ON_DEACTIVATION: z.string().optional(),
  VITE_ATTACHMENT_SERVICE_TYPE: z.string().optional(),
  VITE_ATTACHMENT_DOCUMENT_ID_PREFIX: z.string().optional(),
  VITE_AUTOSUGGEST_SOURCE: z.string().optional(),
  VITE_AUTOSUGGEST_MAPBOX_KEY: z.string().optional(),
  VITE_MAPBOX_ADDRESS_COUNTRY: z.string().optional(),
  VITE_AUTOSUGGEST_MAPTILER_KEY: z.string().optional(),
  VITE_MAPTILER_ADDRESS_COUNTRY: z.string().optional(),
  NODE_ENV: z.string().optional(),
});

type RawEnv = z.infer<typeof EnvSchema>;

const rawEnv: RawEnv = EnvSchema.parse({
  VITE_DEBUG_POUCHDB: import.meta.env.VITE_DEBUG_POUCHDB,
  VITE_DEBUG_APP: import.meta.env.VITE_DEBUG_APP,
  VITE_SHOW_POUCHDB_BROWSER: import.meta.env.VITE_SHOW_POUCHDB_BROWSER,
  VITE_SHOW_WIPE: import.meta.env.VITE_SHOW_WIPE,
  VITE_SHOW_NEW_NOTEBOOK: import.meta.env.VITE_SHOW_NEW_NOTEBOOK,
  VITE_POUCH_BATCH_SIZE: import.meta.env.VITE_POUCH_BATCH_SIZE,
  VITE_POUCH_BATCHES_LIMIT: import.meta.env.VITE_POUCH_BATCHES_LIMIT,
  VITE_SYNC_PUSH_ONLY_RECORD_THRESHOLD: import.meta.env
    .VITE_SYNC_PUSH_ONLY_RECORD_THRESHOLD,
  VITE_DIRECTORY_USERNAME: import.meta.env.VITE_DIRECTORY_USERNAME,
  VITE_DIRECTORY_PASSWORD: import.meta.env.VITE_DIRECTORY_PASSWORD,
  VITE_CLUSTER_ADMIN_GROUP_NAME: import.meta.env.VITE_CLUSTER_ADMIN_GROUP_NAME,
  VITE_BUGSNAG_KEY: import.meta.env.VITE_BUGSNAG_KEY,
  VITE_CONDUCTOR_URL: import.meta.env.VITE_CONDUCTOR_URL,
  VITE_NOTEBOOK_LIST_TYPE: import.meta.env.VITE_NOTEBOOK_LIST_TYPE,
  VITE_NOTEBOOK_NAME: import.meta.env.VITE_NOTEBOOK_NAME,
  VITE_APP_ID: import.meta.env.VITE_APP_ID,
  VITE_APP_NAME: import.meta.env.VITE_APP_NAME,
  VITE_HEADING_APP_NAME: import.meta.env.VITE_HEADING_APP_NAME,
  VITE_APP_PRIVACY_POLICY_URL: import.meta.env.VITE_APP_PRIVACY_POLICY_URL,
  VITE_APP_CONTACT_URL: import.meta.env.VITE_APP_CONTACT_URL,
  VITE_SUPPORT_EMAIL: import.meta.env.VITE_SUPPORT_EMAIL,
  VITE_TOKEN_REFRESH_INTERVAL_MS: import.meta.env
    .VITE_TOKEN_REFRESH_INTERVAL_MS,
  VITE_TOKEN_REFRESH_WINDOW_MS: import.meta.env.VITE_TOKEN_REFRESH_WINDOW_MS,
  VITE_LOGIN_BANNER_GRACE_MS: import.meta.env.VITE_LOGIN_BANNER_GRACE_MS,
  VITE_IGNORE_TOKEN_EXP: import.meta.env.VITE_IGNORE_TOKEN_EXP,
  VITE_MAP_SOURCE: import.meta.env.VITE_MAP_SOURCE,
  VITE_MAP_SOURCE_KEY: import.meta.env.VITE_MAP_SOURCE_KEY,
  VITE_MAP_STYLE: import.meta.env.VITE_MAP_STYLE,
  VITE_SATELLITE_SOURCE: import.meta.env.VITE_SATELLITE_SOURCE,
  VITE_OFFLINE_MAPS: import.meta.env.VITE_OFFLINE_MAPS,
  VITE_NAVIGATION: import.meta.env.VITE_NAVIGATION,
  VITE_SHOW_RECORD_LINKS: import.meta.env.VITE_SHOW_RECORD_LINKS,
  VITE_MIGRATE_OLD_DATABASES: import.meta.env.VITE_MIGRATE_OLD_DATABASES,
  VITE_FORCE_REMOTE_DELETION: import.meta.env.VITE_FORCE_REMOTE_DELETION,
  VITE_DELETE_ON_DEACTIVATION: import.meta.env.VITE_DELETE_ON_DEACTIVATION,
  VITE_ATTACHMENT_SERVICE_TYPE: import.meta.env.VITE_ATTACHMENT_SERVICE_TYPE,
  VITE_ATTACHMENT_DOCUMENT_ID_PREFIX: import.meta.env
    .VITE_ATTACHMENT_DOCUMENT_ID_PREFIX,
  VITE_AUTOSUGGEST_SOURCE: import.meta.env.VITE_AUTOSUGGEST_SOURCE,
  VITE_AUTOSUGGEST_MAPBOX_KEY: import.meta.env.VITE_AUTOSUGGEST_MAPBOX_KEY,
  VITE_MAPBOX_ADDRESS_COUNTRY: import.meta.env.VITE_MAPBOX_ADDRESS_COUNTRY,
  VITE_AUTOSUGGEST_MAPTILER_KEY: import.meta.env.VITE_AUTOSUGGEST_MAPTILER_KEY,
  VITE_MAPTILER_ADDRESS_COUNTRY: import.meta.env.VITE_MAPTILER_ADDRESS_COUNTRY,
  NODE_ENV: import.meta.env.NODE_ENV,
});

// ---------------------------------------------------------------------------
// Reusable pass-two field builders.
// ---------------------------------------------------------------------------

const isBlank = (v: string | undefined): v is undefined | '' =>
  v === undefined || v === '';

/** Non-empty string with a default. */
const stringFromEnv = (def: string) =>
  z
    .string()
    .optional()
    .transform(v => (isBlank(v) ? def : v));

/** Integer with default; blank or unparseable falls back to the default. */
const intFromEnv = (def: number) =>
  z
    .string()
    .optional()
    .transform(v => {
      if (isBlank(v)) return def;
      const parsed = parseInt(v, 10);
      return Number.isNaN(parsed) ? def : parsed;
    });

/**
 * Boolean parsed from the truthy/falsey string sets. Blank falls back to
 * `def`; an unrecognised value logs a warning and falls back to `badFallback`
 * (defaults to `def`).
 */
const boolFromEnv = (
  def: boolean,
  opts: {label?: string; badFallback?: boolean} = {}
) =>
  z
    .string()
    .optional()
    .transform(v => {
      if (isBlank(v)) return def;
      const lower = v.toLowerCase();
      if (FALSEY_STRINGS.includes(lower)) return false;
      if (TRUTHY_STRINGS.includes(lower)) return true;
      const fallback = opts.badFallback ?? def;
      if (opts.label) {
        logError(`${opts.label} badly defined, assuming ${fallback}`);
      }
      return fallback;
    });

/** Boolean that is only true when the value strictly equals `match`. */
const truthyOnlyBool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform(v => (isBlank(v) ? def : TRUTHY_STRINGS.includes(v.toLowerCase())));

// ---------------------------------------------------------------------------
// Pass two: build the typed configuration values.
// ---------------------------------------------------------------------------

const ConfigSchema = z.object({
  debugPouchdb: boolFromEnv(false, {label: 'VITE_DEBUG_POUCHDB'}),
  // Note: badly-defined VITE_DEBUG_APP historically defaults to true.
  debugApp: boolFromEnv(false, {label: 'VITE_DEBUG_APP', badFallback: true}),
  showPouchdbBrowser: boolFromEnv(true, {label: 'VITE_SHOW_POUCHDB_BROWSER'}),
  showWipe: boolFromEnv(true, {label: 'VITE_SHOW_WIPE'}),
  showNewNotebook: boolFromEnv(true, {label: 'VITE_SHOW_NEW_NOTEBOOK'}),
  pouchBatchSize: intFromEnv(10),
  pouchBatchesLimit: intFromEnv(10),
  syncPushOnlyRecordThreshold: intFromEnv(500),
  clusterAdminGroupName: stringFromEnv('cluster-admin'),
  notebookListType: z
    .string()
    .optional()
    .transform((v): 'tabs' | 'headings' =>
      v === 'headings' ? 'headings' : 'tabs'
    ),
  notebookName: stringFromEnv('notebook'),
  appId: stringFromEnv('org.fedarch.faims3'),
  appName: stringFromEnv('Fieldmark'),
  privacyPolicyUrl: stringFromEnv('https://fieldnote.au/privacy'),
  contactUrl: stringFromEnv(''),
  supportEmail: stringFromEnv('support@fieldmark.au'),
  tokenRefreshIntervalMs: intFromEnv(15000),
  tokenRefreshWindowMs: intFromEnv(60000),
  loginBannerGraceMs: intFromEnv(10000),
  ignoreTokenExp: z
    .string()
    .optional()
    .transform(v => (isBlank(v) ? false : v.toUpperCase() === 'TRUE')),
  mapSource: stringFromEnv('osm'),
  mapSourceKey: stringFromEnv(''),
  mapStyle: z
    .string()
    .optional()
    .transform((v): MapStylesheetNameType =>
      isBlank(v) ? 'basic' : (v as MapStylesheetNameType)
    ),
  satelliteSource: z
    .string()
    .optional()
    .transform((v): 'esri' | 'maptiler' | undefined =>
      isBlank(v) ? undefined : (v as 'esri' | 'maptiler')
    ),
  navigationStyle: z
    .string()
    .optional()
    .transform((v): NavigationStyleOption =>
      isBlank(v) ? 'none' : (v as NavigationStyleOption)
    ),
  showRecordLinks: truthyOnlyEquals('true'),
  migrateOldDatabases: truthyOnlyBool(false),
  forceRemoteDeletion: z
    .string()
    .optional()
    .transform((v): ForceRemoteDeletionMode => {
      if (v === 'allow') return 'allow';
      if (v !== undefined && v !== '' && v !== 'never') {
        logError(
          `VITE_FORCE_REMOTE_DELETION invalid (${v}); use allow or never. Assuming never.`
        );
      }
      return 'never';
    }),
  deleteOnDeactivation: boolFromEnv(false, {
    label: 'VITE_DELETE_ON_DEACTIVATION',
  }),
  attachmentServiceType: stringFromEnv('COUCH'),
  attachmentDocumentIdPrefix: z
    .string()
    .optional()
    .transform((v): string | undefined => (isBlank(v) ? undefined : v)),
  bugsnagKey: z
    .string()
    .optional()
    .transform((v): string | undefined =>
      isBlank(v) || v === 'false' ? undefined : v
    ),
  mapboxAccessToken: z
    .string()
    .optional()
    .transform((v): string | undefined =>
      v === undefined || v.trim() === '' ? undefined : v.trim()
    ),
  mapboxAddressCountry: csvUpperFromEnv(DEFAULT_MAPBOX_ADDRESS_COUNTRY),
  maptilerAddressCountry: csvUpperFromEnv(DEFAULT_MAPBOX_ADDRESS_COUNTRY),
  autosuggestSource: z
    .string()
    .optional()
    .transform((v): AutosuggestSource => {
      if (v === undefined || v === '') {
        return AutosuggestSource.NONE;
      }
      const upper = v.toUpperCase();
      if (upper in AutosuggestSource) {
        return AutosuggestSource[upper as keyof typeof AutosuggestSource];
      }
      logError(
        `VITE_AUTOSUGGEST_SOURCE invalid (${v}), using NONE. Valid: NONE, MAPBOX, MAPTILER.`
      );
      return AutosuggestSource.NONE;
    }),
});

/** Boolean that is only true when the (case-insensitive) value equals `match`. */
function truthyOnlyEquals(match: string) {
  return z
    .string()
    .optional()
    .transform(v => v === match);
}

/** Comma-separated uppercase list with a default when blank. */
function csvUpperFromEnv(def: string[]) {
  return z
    .string()
    .optional()
    .transform(v =>
      v === undefined || v.trim() === ''
        ? def
        : v
            .split(',')
            .map(s => s.trim().toUpperCase())
            .filter(Boolean)
    );
}

const parsedConfig = ConfigSchema.parse({
  debugPouchdb: rawEnv.VITE_DEBUG_POUCHDB,
  debugApp: rawEnv.VITE_DEBUG_APP,
  showPouchdbBrowser: rawEnv.VITE_SHOW_POUCHDB_BROWSER,
  showWipe: rawEnv.VITE_SHOW_WIPE,
  showNewNotebook: rawEnv.VITE_SHOW_NEW_NOTEBOOK,
  pouchBatchSize: rawEnv.VITE_POUCH_BATCH_SIZE,
  pouchBatchesLimit: rawEnv.VITE_POUCH_BATCHES_LIMIT,
  syncPushOnlyRecordThreshold: rawEnv.VITE_SYNC_PUSH_ONLY_RECORD_THRESHOLD,
  clusterAdminGroupName: rawEnv.VITE_CLUSTER_ADMIN_GROUP_NAME,
  notebookListType: rawEnv.VITE_NOTEBOOK_LIST_TYPE,
  notebookName: rawEnv.VITE_NOTEBOOK_NAME,
  appId: rawEnv.VITE_APP_ID,
  appName: rawEnv.VITE_APP_NAME,
  privacyPolicyUrl: rawEnv.VITE_APP_PRIVACY_POLICY_URL,
  contactUrl: rawEnv.VITE_APP_CONTACT_URL,
  supportEmail: rawEnv.VITE_SUPPORT_EMAIL,
  tokenRefreshIntervalMs: rawEnv.VITE_TOKEN_REFRESH_INTERVAL_MS,
  tokenRefreshWindowMs: rawEnv.VITE_TOKEN_REFRESH_WINDOW_MS,
  loginBannerGraceMs: rawEnv.VITE_LOGIN_BANNER_GRACE_MS,
  ignoreTokenExp: rawEnv.VITE_IGNORE_TOKEN_EXP,
  mapSource: rawEnv.VITE_MAP_SOURCE,
  mapSourceKey: rawEnv.VITE_MAP_SOURCE_KEY,
  mapStyle: rawEnv.VITE_MAP_STYLE,
  satelliteSource: rawEnv.VITE_SATELLITE_SOURCE,
  navigationStyle: rawEnv.VITE_NAVIGATION,
  showRecordLinks: rawEnv.VITE_SHOW_RECORD_LINKS,
  migrateOldDatabases: rawEnv.VITE_MIGRATE_OLD_DATABASES,
  forceRemoteDeletion: rawEnv.VITE_FORCE_REMOTE_DELETION,
  deleteOnDeactivation: rawEnv.VITE_DELETE_ON_DEACTIVATION,
  attachmentServiceType: rawEnv.VITE_ATTACHMENT_SERVICE_TYPE,
  attachmentDocumentIdPrefix: rawEnv.VITE_ATTACHMENT_DOCUMENT_ID_PREFIX,
  bugsnagKey: rawEnv.VITE_BUGSNAG_KEY,
  mapboxAccessToken: rawEnv.VITE_AUTOSUGGEST_MAPBOX_KEY,
  mapboxAddressCountry: rawEnv.VITE_MAPBOX_ADDRESS_COUNTRY,
  maptilerAddressCountry: rawEnv.VITE_MAPTILER_ADDRESS_COUNTRY,
  autosuggestSource: rawEnv.VITE_AUTOSUGGEST_SOURCE,
});

// ---------------------------------------------------------------------------
// Derived / inter-dependent values.
// ---------------------------------------------------------------------------

/**
 * Splits the input, trimming for whitespace and filtering empty strings.
 * Handles cases including an empty resulting list, and warns on empty strings
 * being contained. Falls through to the DEFAULT_CONDUCTOR_URL where needed.
 * @returns A list of conductor URLs which can act as servers.
 */
export function parseConductorUrls(conductorUrls: string): string[] {
  const urls = conductorUrls.split(',');
  // Provide a warning if the split results in any empty strings
  if (urls.some((url: string) => url.length === 0)) {
    console.warn(
      `CONDUCTOR_URL value was provided, but when split, contained entries which were empty. Value: ${conductorUrls}. After split: ${urls}.`
    );
  }
  // return URLs without trailing whitespace and excluding any values which are empty e.g. due to a trailing comma

  const filteredUrls = urls
    .map((url: string) => url.trim())
    .filter((url: string) => url.length > 0);

  // Provide a warning if the split results in an empty list
  if (!(filteredUrls.length > 0)) {
    console.error(
      `CONDUCTOR_URL value was provided, but when split, trimmed, and empty strings removed, had a length of zero. Value: ${conductorUrls}. After split: ${urls}. After filter: ${filteredUrls}. Returning default [${DEFAULT_CONDUCTOR_URL}]`
    );
    return [DEFAULT_CONDUCTOR_URL];
  }

  return filteredUrls;
}

function buildConductorUrls(): string[] {
  const conductorUrls = rawEnv.VITE_CONDUCTOR_URL;
  if (conductorUrls) {
    return parseConductorUrls(conductorUrls);
  }
  console.warn(
    `No CONDUCTOR URL configured, using default development server at ${DEFAULT_CONDUCTOR_URL}.`
  );
  return [DEFAULT_CONDUCTOR_URL];
}

function buildDirectoryAuth():
  | undefined
  | {username: string; password: string} {
  const username = rawEnv.VITE_DIRECTORY_USERNAME;
  const password = rawEnv.VITE_DIRECTORY_PASSWORD;
  if (isBlank(username) || isBlank(password)) {
    return undefined;
  }
  return {username, password};
}

/**
 * MapTiler API key when AUTOSUGGEST_SOURCE is MAPTILER. Uses the dedicated
 * VITE_AUTOSUGGEST_MAPTILER_KEY if set; otherwise, when the map source is
 * maptiler, reuses VITE_MAP_SOURCE_KEY so a single key can serve both tiles and
 * geocoding. If neither is set, returns undefined and autosuggest is disabled.
 */
function buildMapTilerApiKey(): string | undefined {
  const dedicated = rawEnv.VITE_AUTOSUGGEST_MAPTILER_KEY;
  if (dedicated !== undefined && dedicated.trim() !== '') {
    return dedicated.trim();
  }
  const mapSource = rawEnv.VITE_MAP_SOURCE;
  const mapKey = rawEnv.VITE_MAP_SOURCE_KEY;
  if (mapSource === 'maptiler' && mapKey !== undefined && mapKey.trim() !== '') {
    return mapKey.trim();
  }
  return undefined;
}

const notebookName = parsedConfig.notebookName;
const notebookNamePlural = pluralize(notebookName);

/**
 * The singleton configuration object. Prefer reading values from here.
 */
export const config = {
  ...parsedConfig,
  notebookNameCapitalized:
    notebookName.charAt(0).toUpperCase() + notebookName.slice(1),
  notebookNamePlural,
  notebookNamePluralCapitalized:
    notebookNamePlural.charAt(0).toUpperCase() + notebookNamePlural.slice(1),
  headingAppName: isBlank(rawEnv.VITE_HEADING_APP_NAME)
    ? parsedConfig.appName
    : rawEnv.VITE_HEADING_APP_NAME,
  conductorUrls: buildConductorUrls(),
  directoryAuth: buildDirectoryAuth(),
  runningUnderTest: rawEnv.NODE_ENV === 'test',
  // OSM does not allow bulk downloads so we can't enable offline maps
  offlineMaps:
    (rawEnv.VITE_OFFLINE_MAPS === 'true' && parsedConfig.mapSource !== 'osm') ||
    false,
  maptilerApiKey: buildMapTilerApiKey(),
};

export type Config = typeof config;

// ---------------------------------------------------------------------------
// Advanced surfaces: keep the existing functional interfaces.
// ---------------------------------------------------------------------------

// get the map configuration
export function getMapConfig(): MapConfig {
  const mapConfig: MapConfig = {
    mapSource: config.mapSource,
    mapSourceKey: config.mapSourceKey,
    mapStyle: config.mapStyle,
  };

  if (config.satelliteSource) {
    mapConfig.satelliteSource = config.satelliteSource;
  }

  return mapConfig;
}

let addressAutosuggestServiceInstance: IAutosuggestAddressService | null = null;

function createAddressAutosuggestServiceInstance(): IAutosuggestAddressService | null {
  if (addressAutosuggestServiceInstance !== null) {
    return addressAutosuggestServiceInstance;
  }
  const source = config.autosuggestSource;
  if (source === AutosuggestSource.NONE) {
    return null;
  }
  if (source === AutosuggestSource.MAPBOX) {
    const apiKey = config.mapboxAccessToken;
    if (!apiKey) {
      logError(
        'VITE_AUTOSUGGEST_SOURCE is MAPBOX but VITE_AUTOSUGGEST_MAPBOX_KEY is not set; address autosuggest disabled.'
      );
      return null;
    }
    addressAutosuggestServiceInstance = new MapboxAutosuggestAddressService({
      apiKey,
      language: 'en',
      limit: 10,
      types: 'address',
      country: config.mapboxAddressCountry,
    });
    return addressAutosuggestServiceInstance;
  }
  if (source === AutosuggestSource.MAPTILER) {
    const apiKey = config.maptilerApiKey;
    if (!apiKey) {
      logError(
        'VITE_AUTOSUGGEST_SOURCE is MAPTILER but no MapTiler API key available (set VITE_AUTOSUGGEST_MAPTILER_KEY or, when using MapTiler for maps, VITE_MAP_SOURCE_KEY); address autosuggest disabled.'
      );
      return null;
    }
    addressAutosuggestServiceInstance = new MapTilerAutosuggestAddressService({
      apiKey,
      language: 'en',
      limit: 10,
      types: ['address'],
      country: config.maptilerAddressCountry,
    });
    return addressAutosuggestServiceInstance;
  }
  return null;
}

/**
 * Returns a factory for the address autosuggest service based on
 * VITE_AUTOSUGGEST_SOURCE and provider-specific env (VITE_AUTOSUGGEST_MAPBOX_KEY or VITE_AUTOSUGGEST_MAPTILER_KEY / VITE_MAP_SOURCE_KEY for MapTiler).
 * Use as FullFormConfig.addressAutosuggestService. When NONE or config missing,
 * the factory returns undefined so AddressField skips autocomplete.
 */
export function getAddressAutosuggestService():
  | (() => IAutosuggestAddressService)
  | undefined {
  const instance = createAddressAutosuggestServiceInstance();
  if (instance === null) {
    return undefined;
  }
  return () => instance;
}

// ---------------------------------------------------------------------------
// Non-env constants and runtime-derived values (kept as dedicated exports).
// ---------------------------------------------------------------------------

export const AUTOACTIVATE_LISTINGS = true;

/** Max characters shown for root description on the notebook listing page. */
export const NOTEBOOK_LIST_DESCRIPTION_MAX_LENGTH = 50;

export const CAPACITOR_PLATFORM = Capacitor.getPlatform() as
  | 'ios'
  | 'android'
  | 'web';
export const IS_MOBILE_PLATFORM =
  CAPACITOR_PLATFORM === 'ios' || CAPACITOR_PLATFORM === 'android';
export const IS_WEB_PLATFORM = CAPACITOR_PLATFORM === 'web';

// ==================
// Version management
// ==================

/**
 * Gets the application version from Vite's __APP_VERSION__ replacement.
 * This should be defined in vite.config and filled at build time.
 * @returns The application version.
 */
function appVersion(): string {
  const version = __APP_VERSION__;
  if (version) {
    console.info(`Using APP_VERSION from build: ${__APP_VERSION__}`);
    return version;
  }

  console.error('__APP_VERSION__ not defined in build. Using "unknown"');
  return 'unknown';
}

/**
 * Gets the commit hash from environment variables if available.
 * This is optional and may not be provided in all environments.
 * @returns The commit hash, or undefined if not provided.
 */
function commitHash(): string | undefined {
  const hash = import.meta.env.VITE_COMMIT_VERSION;

  if (
    hash === '' ||
    hash === undefined ||
    FALSEY_STRINGS.includes(hash.toLowerCase())
  ) {
    console.info('VITE_COMMIT_VERSION not provided');
    return undefined;
  }

  console.info(`Using VITE_COMMIT_VERSION: ${hash}`);
  return hash;
}

export const APP_VERSION = appVersion();
export const COMMIT_HASH = commitHash();
