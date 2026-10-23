// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: buildconfig.ts
 * Description:
 *   This module exports the configuration of the build, including things like
 *   which server to use and whether to include test data.
 *   Configuration is parsed from Vite's `import.meta.env` via the shared
 *   @faims3/build-config module (`parseGeneratedEnv`), the single source of
 *   truth for the config chain. This module then layers on app-specific
 *   derivation that is not shared coercion/defaults: the paired directory
 *   credentials, the MapTiler key fallback (reuse the map-source key when no
 *   dedicated key is set and the map source is maptiler), the aggregated map
 *   config, pluralised notebook names and the build-time `__APP_VERSION__`
 *   inject.
 *   Prefer importing `{config}` and reading `config.<field>`. Advanced surfaces
 *   that need a factory (map config for form managers, address autosuggest)
 *   keep thin functional wrappers sourced from `config`.
 */

import {Capacitor} from '@capacitor/core';
import {parseGeneratedEnv} from '@faims3/build-config';
import {
  type IAutosuggestAddressService,
  MapboxAutosuggestAddressService,
  MapTilerAutosuggestAddressService,
  type MapConfig,
} from '@faims3/forms';
import pluralize from 'pluralize';

// need to define a local logError here since logging.tsx imports this file
const logError = (err: any) => console.error(err);

/**
 * Source for address autosuggest service. NONE disables autocomplete; MAPBOX
 * uses Mapbox Search Box API (requires VITE_AUTOSUGGEST_MAPBOX_KEY); MAPTILER
 * uses MapTiler Search and Geocoding API (VITE_AUTOSUGGEST_MAPTILER_KEY, or
 * VITE_MAP_SOURCE_KEY when map source is maptiler).
 */
export enum AutosuggestSource {
  /** No address autosuggest; AddressField uses manual entry only. */
  NONE = 'none',
  /** Mapbox Search Box API (suggest + retrieve). */
  MAPBOX = 'mapbox',
  /** MapTiler Search and Geocoding API (forward + by-id). */
  MAPTILER = 'maptiler',
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
// Canonical config, parsed from the generated env by the shared module.
// ---------------------------------------------------------------------------

const canonical = parseGeneratedEnv(import.meta.env);

const notebookName = canonical.notebookAndRecordUX.notebookName;
const notebookNamePlural = pluralize(notebookName);

// MapTiler API key: a dedicated key, else reuse the map-source key when the map
// source is maptiler so one key serves both tiles and geocoding.
const dedicatedMapTilerKey = canonical.maps.autosuggestMapTilerKey;
const maptilerApiKey =
  dedicatedMapTilerKey && dedicatedMapTilerKey.trim() !== ''
    ? dedicatedMapTilerKey.trim()
    : canonical.maps.mapSource === 'maptiler' &&
        canonical.maps.mapSourceKey !== ''
      ? canonical.maps.mapSourceKey
      : undefined;

// Build-time version inject via Vite `define` (__APP_VERSION__ from
// package.json — not an import.meta.env key). Falls back to 'unknown'.
let appVersion = 'unknown';
if (__APP_VERSION__) {
  console.info(`Using APP_VERSION from build: ${__APP_VERSION__}`);
  appVersion = __APP_VERSION__;
} else {
  console.error('__APP_VERSION__ not defined in build. Using "unknown"');
}

const mapConfig: MapConfig = {
  mapSource: canonical.maps.mapSource,
  mapSourceKey: canonical.maps.mapSourceKey,
  mapStyle: canonical.maps.mapStyle,
};
if (canonical.maps.satelliteSource) {
  mapConfig.satelliteSource = canonical.maps.satelliteSource;
}

// Node environment; `'test'` sets `runningUnderTest` (runtime, not env config).
const runningUnderTest = import.meta.env.NODE_ENV === 'test';

export const config = {
  // Env-backed values, sourced from the shared canonical config.
  debugPouchdb: canonical.dev.debugPouchDb,
  debugApp: canonical.dev.debugApp,
  showPouchdbBrowser: canonical.dev.showPouchDbBrowser,
  showWipe: canonical.dev.showWipe,
  showStatusTab: canonical.notebookAndRecordUX.showStatusTab,
  pouchBatchSize: canonical.pouchdb.pouchBatchSize,
  pouchBatchesLimit: canonical.pouchdb.pouchBatchesLimit,
  syncPushOnlyRecordThreshold: canonical.sync.syncPushOnlyRecordThreshold,
  notebookListType: canonical.notebookAndRecordUX.notebookListType,
  notebookName,
  notebookNameCapitalized:
    notebookName.charAt(0).toUpperCase() + notebookName.slice(1),
  notebookNamePlural,
  notebookNamePluralCapitalized:
    notebookNamePlural.charAt(0).toUpperCase() + notebookNamePlural.slice(1),
  appId: canonical.android.appId,
  appName: canonical.branding.appName,
  headingAppName: canonical.branding.headingAppName,
  privacyPolicyUrl: canonical.support.privacyPolicyUrl,
  contactUrl: canonical.support.appContactUrl,
  supportEmail: canonical.support.supportEmail,
  theme: canonical.branding.theme,
  tokenRefreshIntervalMs: canonical.authTokens.tokenRefreshIntervalMs,
  tokenRefreshWindowMs: canonical.authTokens.tokenRefreshWindowMs,
  loginBannerGraceMs: canonical.authTokens.loginBannerGraceMs,
  ignoreTokenExp: canonical.authTokens.ignoreTokenExp,
  mapSource: canonical.maps.mapSource,
  mapSourceKey: canonical.maps.mapSourceKey,
  mapStyle: canonical.maps.mapStyle,
  satelliteSource: canonical.maps.satelliteSource,
  navigationStyle: canonical.notebookAndRecordUX.navigation,
  migrateOldDatabases: canonical.migration.migrateOldDatabases,
  forceRemoteDeletion: canonical.sync.forceRemoteDeletion,
  deleteOnDeactivation: canonical.sync.deleteOnDeactivation,
  attachmentServiceType: canonical.attachments.attachmentServiceType,
  attachmentDocumentIdPrefix: canonical.attachments.attachmentDocumentIdPrefix,
  bugsnagKey: canonical.observability.bugsnagApiKey,
  mapboxAccessToken: canonical.maps.autosuggestMapboxKey,
  mapboxAddressCountry: canonical.maps.mapboxAddressCountry,
  maptilerAddressCountry: canonical.maps.maptilerAddressCountry,
  autosuggestSource: canonical.maps.autosuggestSource as AutosuggestSource,
  conductorUrls: canonical.endpoints.conductorUrls,

  // App-specific derivation (see module header).
  runningUnderTest,
  maptilerApiKey,
  // OSM does not allow bulk downloads; the shared model already forces
  // offlineMaps off for OSM.
  offlineMaps: canonical.maps.offlineMaps,
  appVersion,
  commitHash: canonical.observability.commitVersion,
  mapConfig,
};

export type Config = typeof config;

// ---------------------------------------------------------------------------
// Advanced surfaces: keep the existing functional interfaces.
// ---------------------------------------------------------------------------

/** Build the map configuration object consumed by map UI components. */
export function getMapConfig(): MapConfig {
  return config.mapConfig;
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
        "VITE_AUTOSUGGEST_SOURCE is 'maptiler' but no MapTiler API key available (set VITE_AUTOSUGGEST_MAPTILER_KEY or, when using MapTiler for maps, VITE_MAP_SOURCE_KEY); address autosuggest disabled."
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
 * VITE_AUTOSUGGEST_SOURCE and provider-specific env (VITE_AUTOSUGGEST_MAPBOX_KEY or
 * VITE_AUTOSUGGEST_MAPTILER_KEY / VITE_MAP_SOURCE_KEY for MapTiler).
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
