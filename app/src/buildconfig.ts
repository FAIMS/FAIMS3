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
 *   Configuration is parsed from Vite's `import.meta.env` with a single zod
 *   schema:
 *     - Each env key is declared once with its coercion / defaulting logic and
 *       is the place to document that setting.
 *     - The raw object is `import.meta.env` (Vite); `.strip()` drops built-ins
 *       and undeclared keys.
 *     - A final `.transform()` renames ENV_KEYS into the camelCase `config`
 *       shape (and builds cross-field values). Do not re-document env-backed
 *       fields in the transform.
 *
 *   Prefer importing `{config}` and reading `config.<field>`. Advanced surfaces
 *   that need a factory (map config for form managers, address autosuggest)
 *   keep thin functional wrappers sourced from `config`.
 */

import {Capacitor} from '@capacitor/core';
import {configHelpers} from '@faims3/data-model';
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

// Default conductor URL
export const DEFAULT_CONDUCTOR_URL = 'http://localhost:8154';

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

const MAP_STYLESHEET_NAMES = [
  'basic',
  'openstreetmap',
  'osm-bright',
  'toner',
] as const satisfies readonly MapStylesheetNameType[];

/**
 * Splits the input, trimming for whitespace and filtering empty strings.
 * Handles cases including an empty resulting list, and warns on empty strings
 * being contained. Falls through to the DEFAULT_CONDUCTOR_URL where needed.
 * @returns A list of conductor URLs which can act as servers.
 */
export function parseConductorUrls(conductorUrls: string): string[] {
  const urls = conductorUrls.split(',');
  if (urls.some((url: string) => url.length === 0)) {
    console.warn(
      `CONDUCTOR_URL value was provided, but when split, contained entries which were empty. Value: ${conductorUrls}. After split: ${urls}.`
    );
  }

  const filteredUrls = urls
    .map((url: string) => url.trim())
    .filter((url: string) => url.length > 0);

  if (!(filteredUrls.length > 0)) {
    console.error(
      `CONDUCTOR_URL value was provided, but when split, trimmed, and empty strings removed, had a length of zero. Value: ${conductorUrls}. After split: ${urls}. After filter: ${filteredUrls}. Returning default [${DEFAULT_CONDUCTOR_URL}]`
    );
    return [DEFAULT_CONDUCTOR_URL];
  }

  return filteredUrls;
}

// ---------------------------------------------------------------------------
// Single-pass env schema: validate/coerce, strip unknowns, rename to config.
// ---------------------------------------------------------------------------

const EnvSchema = z
  .object({
    /** Enable verbose PouchDB logging. */
    VITE_DEBUG_POUCHDB: configHelpers.boolWithDefault(false),
    /** Enable verbose app logging. */
    VITE_DEBUG_APP: configHelpers.boolWithDefault(false),
    /** Show the in-app PouchDB browser / inspector UI. */
    VITE_SHOW_POUCHDB_BROWSER: configHelpers.boolWithDefault(true),
    /** Show the "wipe local data" developer affordance. */
    VITE_SHOW_WIPE: configHelpers.boolWithDefault(true),
    /** Show the "create new notebook" UI affordance. */
    VITE_SHOW_NEW_NOTEBOOK: configHelpers.boolWithDefault(true),
    /** See `batch_size` in https://pouchdb.com/api.html#replication */
    VITE_POUCH_BATCH_SIZE: configHelpers.intDefault(10),
    /** See `batches_limit` in https://pouchdb.com/api.html#replication */
    VITE_POUCH_BATCHES_LIMIT: configHelpers.intDefault(10),
    /**
     * Record count above which activation defaults to push-only sync (when
     * online). 500 is a conservative estimate pending further load testing.
     */
    VITE_SYNC_PUSH_ONLY_RECORD_THRESHOLD: configHelpers.intDefault(500),
    /**
     * Directory auth username (client). Paired with VITE_DIRECTORY_PASSWORD;
     * distinct from server COUCHDB_USER/PASSWORD used for testing.
     */
    VITE_DIRECTORY_USERNAME: z.string().optional(),
    /** Directory auth password paired with VITE_DIRECTORY_USERNAME. */
    VITE_DIRECTORY_PASSWORD: z.string().optional(),
    /** Couch / directory group name treated as cluster admin. */
    VITE_CLUSTER_ADMIN_GROUP_NAME: configHelpers.stringDefault('cluster-admin'),
    /** Bugsnag API key; unset / `'false'` disables Bugsnag. */
    VITE_BUGSNAG_KEY: z
      .string()
      .optional()
      .transform((v): string | undefined =>
        configHelpers.isBlank(v) || v === 'false' ? undefined : v
      ),
    /**
     * Optional git commit hash / build identifier shown in About / support
     * email. Blank or falsey strings are treated as unset.
     */
    VITE_COMMIT_VERSION: z
      .string()
      .optional()
      .transform((v): string | undefined => {
        if (
          configHelpers.isBlank(v) ||
          (configHelpers.FALSEY_STRINGS as readonly string[]).includes(
            v.toLowerCase()
          )
        ) {
          console.info('VITE_COMMIT_VERSION not provided');
          return undefined;
        }
        console.info(`Using VITE_COMMIT_VERSION: ${v}`);
        return v;
      }),
    /**
     * Comma-separated Conductor URLs the app can authenticate against.
     * Parsed via `parseConductorUrls`; falls back to DEFAULT_CONDUCTOR_URL.
     */
    VITE_CONDUCTOR_URL: z
      .string()
      .optional()
      .transform(v => {
        if (configHelpers.isBlank(v)) {
          console.warn(
            `No CONDUCTOR URL configured, using default development server at ${DEFAULT_CONDUCTOR_URL}.`
          );
          return [DEFAULT_CONDUCTOR_URL];
        }
        return parseConductorUrls(v);
      }),
    /** Notebook listing layout: `'tabs'` or `'headings'`. */
    VITE_NOTEBOOK_LIST_TYPE: configHelpers.enumDefault(
      ['tabs', 'headings'],
      'tabs'
    ),
    /**
     * Singular display name for notebooks (e.g. `'notebook'` / `'project'`).
     * Plural / capitalised forms are derived.
     */
    VITE_NOTEBOOK_NAME: configHelpers.stringDefault('notebook'),
    /** Android / iOS application identifier. */
    VITE_APP_ID: configHelpers.stringDefault('org.fedarch.faims3'),
    /** Product display name. */
    VITE_APP_NAME: configHelpers.stringDefault('Fieldmark'),
    /** Optional heading override; falls back to VITE_APP_NAME when blank. */
    VITE_HEADING_APP_NAME: z.string().optional(),
    /** Privacy-policy URL (defaults to the EFN privacy policy). */
    VITE_APP_PRIVACY_POLICY_URL: configHelpers.stringDefault(
      'https://fieldnote.au/privacy'
    ),
    /**
     * Contact URL shown in the app chrome. Falsy / empty hides the contact
     * link.
     */
    VITE_APP_CONTACT_URL: configHelpers.stringDefault(''),
    /** Support / contact email address. */
    VITE_SUPPORT_EMAIL: configHelpers.stringDefault('support@fieldmark.au'),
    /** Interval (ms) between attempts to refresh all tokens. Default 15s. */
    VITE_TOKEN_REFRESH_INTERVAL_MS: configHelpers.intDefault(15000),
    /**
     * Refresh tokens when they have this much lifetime left (ms). Default
     * 60s — try to refresh before expiry hits the 60-second mark.
     */
    VITE_TOKEN_REFRESH_WINDOW_MS: configHelpers.intDefault(60000),
    /**
     * Grace period (ms) after app initialisation before showing the
     * logged-out banner. Default 10s.
     */
    VITE_LOGIN_BANNER_GRACE_MS: configHelpers.intDefault(10000),
    /**
     * When `'TRUE'` (case-insensitive), ignore JWT expiry and treat tokens as
     * valid for 1 year — disables refreshing. Debug / compat only.
     */
    VITE_IGNORE_TOKEN_EXP: z
      .string()
      .optional()
      .transform(v =>
        configHelpers.isBlank(v) ? false : v.toUpperCase() === 'TRUE'
      ),
    /**
     * Map tile source (see `src/gui/components/map/tile_source.ts`). Pair
     * with VITE_MAP_SOURCE_KEY when the provider needs an API key.
     */
    VITE_MAP_SOURCE: configHelpers.stringDefault('osm'),
    /** API key for the configured map source (when required). */
    VITE_MAP_SOURCE_KEY: configHelpers.stringDefault(''),
    /** Map stylesheet name (`basic`, `openstreetmap`, `osm-bright`, `toner`). */
    VITE_MAP_STYLE: configHelpers.enumDefault(
      [...MAP_STYLESHEET_NAMES],
      'basic'
    ),
    /** Optional satellite imagery provider (`esri` or `maptiler`). */
    VITE_SATELLITE_SOURCE: configHelpers.optionalEnum(['esri', 'maptiler']),
    /**
     * Enable offline map downloads when `'true'`. Forced off for OSM (bulk
     * download not allowed).
     */
    VITE_OFFLINE_MAPS: z.string().optional(),
    /** In-app navigation chrome: `'none'` or `'breadcrumbs'`. */
    VITE_NAVIGATION: configHelpers.enumDefault(
      [
        'none',
        'breadcrumbs',
      ] as const satisfies readonly NavigationStyleOption[],
      'none'
    ),
    /** Show the record-links feature when exactly `'true'`. */
    VITE_SHOW_RECORD_LINKS: configHelpers.truthyOnlyEquals('true'),
    /** Automatically migrate old v1.0-style databases on startup. */
    VITE_MIGRATE_OLD_DATABASES: configHelpers.truthyOnlyBool(false),
    /**
     * When a local notebook is archived / deleted upstream: `'allow'` destroys
     * the local Pouch DB; `'never'` (default) only closes handles so data can
     * be recovered. See `ForceRemoteDeletionMode`.
     */
    VITE_FORCE_REMOTE_DELETION: configHelpers.enumDefault(
      ['allow', 'never'] as const satisfies readonly ForceRemoteDeletionMode[],
      'never'
    ),
    /**
     * When true, manual notebook deactivation destroys the local
     * Pouch/IndexedDB database. When false or unset, deactivation only closes
     * sync and DB handles (IndexedDB may remain).
     */
    VITE_DELETE_ON_DEACTIVATION: configHelpers.boolWithDefault(false),
    /** Attachment storage backend (defaults to `'COUCH'`). */
    VITE_ATTACHMENT_SERVICE_TYPE: configHelpers.stringDefault('COUCH'),
    /** Optional prefix for attachment document IDs. */
    VITE_ATTACHMENT_DOCUMENT_ID_PREFIX: z
      .string()
      .optional()
      .transform((v): string | undefined =>
        configHelpers.isBlank(v) ? undefined : v
      ),
    /**
     * Address autosuggest provider. Resolves to `AutosuggestSource`; invalid
     * or unset defaults to `NONE`.
     */
    VITE_AUTOSUGGEST_SOURCE: configHelpers.nativeEnumDefault(
      AutosuggestSource,
      AutosuggestSource.NONE
    ),
    /**
     * Mapbox access token when AUTOSUGGEST_SOURCE is MAPBOX. Required for
     * MAPBOX; if missing, address autosuggest is effectively disabled.
     */
    VITE_AUTOSUGGEST_MAPBOX_KEY: z
      .string()
      .optional()
      .transform((v): string | undefined =>
        v === undefined || v.trim() === '' ? undefined : v.trim()
      ),
    /**
     * Mapbox address search country filter (ISO 3166-1 alpha-2).
     * Comma-separated codes (e.g. `"AU"` or `"AU,NZ"`). Defaults to Australia.
     */
    VITE_MAPBOX_ADDRESS_COUNTRY: configHelpers.csvUpperWithDefault(
      DEFAULT_MAPBOX_ADDRESS_COUNTRY
    ),
    /**
     * Dedicated MapTiler API key for autosuggest. When blank and map source is
     * `maptiler`, VITE_MAP_SOURCE_KEY is reused so one key serves tiles and
     * geocoding.
     */
    VITE_AUTOSUGGEST_MAPTILER_KEY: z.string().optional(),
    /**
     * MapTiler address search country filter (ISO 3166-1 alpha-2).
     * Comma-separated codes (e.g. `"AU"` or `"AU,NZ"`). Defaults to Australia.
     */
    VITE_MAPTILER_ADDRESS_COUNTRY: configHelpers.csvUpperWithDefault(
      DEFAULT_MAPBOX_ADDRESS_COUNTRY
    ),
    /** Node environment; `'test'` sets `runningUnderTest`. */
    NODE_ENV: z.string().optional(),
  })
  .strip()
  .transform(env => {
    const notebookName = env.VITE_NOTEBOOK_NAME;
    const notebookNamePlural = pluralize(notebookName);

    let directoryAuth: undefined | {username: string; password: string};
    if (
      configHelpers.isBlank(env.VITE_DIRECTORY_USERNAME) ||
      configHelpers.isBlank(env.VITE_DIRECTORY_PASSWORD)
    ) {
      directoryAuth = undefined;
    } else {
      directoryAuth = {
        username: env.VITE_DIRECTORY_USERNAME,
        password: env.VITE_DIRECTORY_PASSWORD,
      };
    }

    // MapTiler API key: dedicated key, else reuse map source key when maptiler.
    let maptilerApiKey: string | undefined;
    const dedicated = env.VITE_AUTOSUGGEST_MAPTILER_KEY;
    if (dedicated !== undefined && dedicated.trim() !== '') {
      maptilerApiKey = dedicated.trim();
    } else if (
      env.VITE_MAP_SOURCE === 'maptiler' &&
      env.VITE_MAP_SOURCE_KEY !== ''
    ) {
      maptilerApiKey = env.VITE_MAP_SOURCE_KEY;
    }

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
      mapSource: env.VITE_MAP_SOURCE,
      mapSourceKey: env.VITE_MAP_SOURCE_KEY,
      mapStyle: env.VITE_MAP_STYLE,
    };
    if (env.VITE_SATELLITE_SOURCE) {
      mapConfig.satelliteSource = env.VITE_SATELLITE_SOURCE;
    }

    // OSM does not allow bulk downloads so we can't enable offline maps.
    const offlineMaps =
      (env.VITE_OFFLINE_MAPS === 'true' && env.VITE_MAP_SOURCE !== 'osm') ||
      false;

    return {
      debugPouchdb: env.VITE_DEBUG_POUCHDB,
      debugApp: env.VITE_DEBUG_APP,
      showPouchdbBrowser: env.VITE_SHOW_POUCHDB_BROWSER,
      showWipe: env.VITE_SHOW_WIPE,
      showNewNotebook: env.VITE_SHOW_NEW_NOTEBOOK,
      pouchBatchSize: env.VITE_POUCH_BATCH_SIZE,
      pouchBatchesLimit: env.VITE_POUCH_BATCHES_LIMIT,
      syncPushOnlyRecordThreshold: env.VITE_SYNC_PUSH_ONLY_RECORD_THRESHOLD,
      clusterAdminGroupName: env.VITE_CLUSTER_ADMIN_GROUP_NAME,
      notebookListType: env.VITE_NOTEBOOK_LIST_TYPE,
      notebookName,
      notebookNameCapitalized:
        notebookName.charAt(0).toUpperCase() + notebookName.slice(1),
      notebookNamePlural,
      notebookNamePluralCapitalized:
        notebookNamePlural.charAt(0).toUpperCase() +
        notebookNamePlural.slice(1),
      appId: env.VITE_APP_ID,
      appName: env.VITE_APP_NAME,
      headingAppName: configHelpers.isBlank(env.VITE_HEADING_APP_NAME)
        ? env.VITE_APP_NAME
        : env.VITE_HEADING_APP_NAME,
      privacyPolicyUrl: env.VITE_APP_PRIVACY_POLICY_URL,
      contactUrl: env.VITE_APP_CONTACT_URL,
      supportEmail: env.VITE_SUPPORT_EMAIL,
      tokenRefreshIntervalMs: env.VITE_TOKEN_REFRESH_INTERVAL_MS,
      tokenRefreshWindowMs: env.VITE_TOKEN_REFRESH_WINDOW_MS,
      loginBannerGraceMs: env.VITE_LOGIN_BANNER_GRACE_MS,
      ignoreTokenExp: env.VITE_IGNORE_TOKEN_EXP,
      mapSource: env.VITE_MAP_SOURCE,
      mapSourceKey: env.VITE_MAP_SOURCE_KEY,
      mapStyle: env.VITE_MAP_STYLE,
      satelliteSource: env.VITE_SATELLITE_SOURCE,
      navigationStyle: env.VITE_NAVIGATION,
      showRecordLinks: env.VITE_SHOW_RECORD_LINKS,
      migrateOldDatabases: env.VITE_MIGRATE_OLD_DATABASES,
      forceRemoteDeletion: env.VITE_FORCE_REMOTE_DELETION,
      deleteOnDeactivation: env.VITE_DELETE_ON_DEACTIVATION,
      attachmentServiceType: env.VITE_ATTACHMENT_SERVICE_TYPE,
      attachmentDocumentIdPrefix: env.VITE_ATTACHMENT_DOCUMENT_ID_PREFIX,
      bugsnagKey: env.VITE_BUGSNAG_KEY,
      mapboxAccessToken: env.VITE_AUTOSUGGEST_MAPBOX_KEY,
      mapboxAddressCountry: env.VITE_MAPBOX_ADDRESS_COUNTRY,
      maptilerAddressCountry: env.VITE_MAPTILER_ADDRESS_COUNTRY,
      autosuggestSource: env.VITE_AUTOSUGGEST_SOURCE,
      conductorUrls: env.VITE_CONDUCTOR_URL,
      directoryAuth,
      runningUnderTest: env.NODE_ENV === 'test',
      maptilerApiKey,
      // Build-time / aggregated (not direct env renames).
      // OSM does not allow bulk downloads so we can't enable offline maps.
      offlineMaps,
      appVersion,
      commitHash: env.VITE_COMMIT_VERSION,
      mapConfig,
    };
  });

/**
 * The singleton configuration object. Prefer reading values from here.
 *
 * Pass the whole `import.meta.env` — `.strip()` drops Vite built-ins
 * (`MODE`, `DEV`, …) and any other keys not declared above.
 */
export const config = EnvSchema.parse(import.meta.env);

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
