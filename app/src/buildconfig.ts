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
 *   which server to use and whether to include test data
 */

import {BUILD_VERSION, BUILD_VERSION_DEFAULT} from './version';

// need to define a local logError here since logging.tsx imports this file
const logError = (err: any) => console.error(err);

// Constants

// Default conductor URL
export const DEFAULT_CONDUCTOR_URL = 'http://localhost:8154';

const TRUTHY_STRINGS = ['true', '1', 'on', 'yes'];
const FALSEY_STRINGS = ['false', '0', 'off', 'no'];

/*
 * This is designed to get useful commit information data from
 * environment variables for the testing server. While more sophisticated
 * iterations of this can use extra node modules to get git data directly,
 * passing environment variables seems like the safest first path.
 */

function commit_version(): string {
  // BUILD_VERSION is updated by the 'set-version' script in package.json
  // use that if it's not just the default
  if (BUILD_VERSION !== BUILD_VERSION_DEFAULT) return BUILD_VERSION;
  // otherwise look in the environment
  const commitVersion = import.meta.env.VITE_COMMIT_VERSION;
  if (
    commitVersion === '' ||
    commitVersion === undefined ||
    FALSEY_STRINGS.includes(commitVersion.toLowerCase())
  ) {
    return 'unknown dev';
  } else {
    return commitVersion;
  }
}

function include_pouchdb_debugging(): boolean {
  const debug_pouch = import.meta.env.VITE_DEBUG_POUCHDB;
  if (debug_pouch === '' || debug_pouch === undefined) {
    return false;
  }
  if (FALSEY_STRINGS.includes(debug_pouch.toLowerCase())) {
    return false;
  } else if (TRUTHY_STRINGS.includes(debug_pouch.toLowerCase())) {
    return true;
  } else {
    logError('VITE_DEBUG_POUCHDB badly defined, assuming false');
    return false;
  }
}

function include_app_debugging(): boolean {
  const debug_app = import.meta.env.VITE_DEBUG_APP;
  if (debug_app === '' || debug_app === undefined) {
    return false;
  }
  if (FALSEY_STRINGS.includes(debug_app.toLowerCase())) {
    return false;
  } else if (TRUTHY_STRINGS.includes(debug_app.toLowerCase())) {
    return true;
  } else {
    logError('VITE_DEBUG_APP badly defined, assuming true');
    return true;
  }
}

function show_minifauxton(): boolean {
  const debug_app = import.meta.env.VITE_SHOW_MINIFAUXTON;
  if (debug_app === '' || debug_app === undefined) {
    return true;
  }
  if (FALSEY_STRINGS.includes(debug_app.toLowerCase())) {
    return false;
  } else if (TRUTHY_STRINGS.includes(debug_app.toLowerCase())) {
    return true;
  } else {
    logError('VITE_SHOW_MINIFAUXTON badly defined, assuming true');
    return true;
  }
}

function show_wipe(): boolean {
  const debug_app = import.meta.env.VITE_SHOW_WIPE;
  if (debug_app === '' || debug_app === undefined) {
    return true;
  }
  if (FALSEY_STRINGS.includes(debug_app.toLowerCase())) {
    return false;
  } else if (TRUTHY_STRINGS.includes(debug_app.toLowerCase())) {
    return true;
  } else {
    logError('VITE_SHOW_WIPE badly defined, assuming true');
    return true;
  }
}

function show_new_notebook(): boolean {
  const debug_app = import.meta.env.VITE_SHOW_NEW_NOTEBOOK;
  if (debug_app === '' || debug_app === undefined) {
    return true;
  }
  if (FALSEY_STRINGS.includes(debug_app.toLowerCase())) {
    return false;
  } else if (TRUTHY_STRINGS.includes(debug_app.toLowerCase())) {
    return true;
  } else {
    logError('VITE_SHOW_NEW_NOTEBOOK badly defined, assuming true');
    return true;
  }
}

/*
 * See batch_size in https://pouchdb.com/api.html#replication
 */
function pouch_batch_size(): number {
  const pouch_batch_size = import.meta.env.VITE_POUCH_BATCH_SIZE;
  if (pouch_batch_size === '' || pouch_batch_size === undefined) {
    return 1000;
  }
  try {
    return parseInt(pouch_batch_size);
  } catch (err) {
    logError(err);
    return 1000;
  }
}

/*
 * See batches_limit in https://pouchdb.com/api.html#replication
 */
function pouch_batches_limit(): number {
  const pouch_batches_limit = import.meta.env.VITE_POUCH_BATCHES_LIMIT;
  if (pouch_batches_limit === '' || pouch_batches_limit === undefined) {
    return 10;
  }
  try {
    return parseInt(pouch_batches_limit);
  } catch (err) {
    logError(err);
    return 10;
  }
}

function directory_auth(): undefined | {username: string; password: string} {
  // Used in the server, as opposed to COUCHDB_USER and PASSWORD for testing.
  const username = import.meta.env.VITE_DIRECTORY_USERNAME;
  const password = import.meta.env.VITE_DIRECTORY_PASSWORD;

  if (
    username === '' ||
    username === undefined ||
    password === '' ||
    password === undefined
  ) {
    return undefined;
  } else {
    return {username: username, password: password};
  }
}

function is_testing() {
  const test_node_env = import.meta.env.NODE_ENV === 'test';
  return test_node_env;
}

function cluster_admin_group_name(): string {
  const name = import.meta.env.VITE_CLUSTER_ADMIN_GROUP_NAME;
  if (name === '' || name === undefined) {
    return 'cluster-admin';
  }
  return name;
}

// If VITE_BUGSNAG_KEY is not defined then we don't use Bugsnag
function get_bugsnag_key(): string | false {
  const bugsnag_key = import.meta.env.VITE_BUGSNAG_KEY;
  if (
    bugsnag_key === '' ||
    bugsnag_key === undefined ||
    bugsnag_key === 'false'
  ) {
    return false;
  }
  return bugsnag_key;
}

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
/**
 * Hands the VITE_CONDUCTOR_URL input to the parse conductor urls method,
 * returning a safely handled list of conductor URLs.
 * @returns A list of conductor URLs which can act as servers.
 */
function get_conductor_urls(): string[] {
  const conductorUrls: string = import.meta.env.VITE_CONDUCTOR_URL;
  if (conductorUrls) {
    return parseConductorUrls(conductorUrls);
  } else {
    console.warn(
      `No CONDUCTOR URL configured, using default development server at ${DEFAULT_CONDUCTOR_URL}.`
    );
    return [DEFAULT_CONDUCTOR_URL];
  }
}

/**
 * Retrieves the notebook list type.
 * @returns The notebook list type, which can be either "tabs" or "headings".
 */
function get_notebook_list_type(): 'tabs' | 'headings' {
  const notebook_list_type = import.meta.env.VITE_NOTEBOOK_LIST_TYPE;
  if (notebook_list_type === 'headings') {
    return 'headings';
  } else {
    return 'tabs';
  }
}

/**
 * Is the VITE_SHOW_RECORD_SUMMARY_COUNTS env variable present and not falsey
 * @returns The notebook list type, which can be either "tabs" or "headings".
 */
function showRecordCounts(): boolean {
  const val = import.meta.env.VITE_SHOW_RECORD_SUMMARY_COUNTS as
    | string
    | undefined;
  if (!val) {
    return false;
  }
  if (['false', 'f'].includes(val.toLowerCase())) {
    return false;
  }
  return true;
}

/**
 * Retrieves the name of notebooks from the environment variables.
 * If the environment variable is not set, it returns a default value 'notebook'.
 *
 * @returns {string} - The name of notebooks.
 */
function get_notebook_name(): string {
  const notebook_name = import.meta.env.VITE_NOTEBOOK_NAME;
  if (notebook_name) {
    return notebook_name;
  } else {
    return 'notebook';
  }
}

/**
 * Retrieves the name of the notebooks and capitalizes the first letter.
 *
 * @returns {string} - The capitalized name of notebooks.
 */
function get_notebook_name_capitalized(): string {
  const notebook_name = get_notebook_name();

  return notebook_name.charAt(0).toUpperCase() + notebook_name.slice(1);
}

/**
 * Retrieves the configured app identifier for Android/IOS
 * @returns {string} - the app id
 */
function get_app_id(): string {
  const appid = import.meta.env.VITE_APP_ID;
  return appid || 'org.fedarch.faims3';
}

/**
 * Retrieves the configured app name
 * @returns {string} - the app name
 */
function get_app_name(): string {
  const appid = import.meta.env.VITE_APP_NAME;
  return appid || 'Fieldmark';
}

/**
 * Retrieves the configured heading app name or falls back to APP_NAME
 * @returns {string} - the app name
 */
function get_heading_app_name(): string {
  const appid = import.meta.env.VITE_HEADING_APP_NAME;
  return appid || get_app_name();
}

// Consider a refresh every 15 seconds
const DEFAULT_TOKEN_REFRESH_INTERVAL_MS = 15000;

/**
 * @returns The interval by which we attempt to refresh all tokens
 */
function tokenRefreshIntervalMs(): number {
  const tokenRefreshIntervalMs = import.meta.env.VITE_TOKEN_REFRESH_INTERVAL_MS;
  if (tokenRefreshIntervalMs === '' || tokenRefreshIntervalMs === undefined) {
    return DEFAULT_TOKEN_REFRESH_INTERVAL_MS;
  }
  try {
    return parseInt(tokenRefreshIntervalMs);
  } catch (err) {
    logError(err);
    return DEFAULT_TOKEN_REFRESH_INTERVAL_MS;
  }
}

// Try and refresh before it hits 60 seconds till expiry
const DEFAULT_TOKEN_REFRESH_WINDOW_MS = 60000;

/**
 * @returns The minimum valid time for a token before attempting refreshes
 */
function tokenRefreshWindowMs(): number {
  const tokenRefreshWindowMs = import.meta.env.VITE_TOKEN_REFRESH_WINDOW_MS;
  if (tokenRefreshWindowMs === '' || tokenRefreshWindowMs === undefined) {
    return DEFAULT_TOKEN_REFRESH_WINDOW_MS;
  }
  try {
    return parseInt(tokenRefreshWindowMs);
  } catch (err) {
    logError(err);
    return DEFAULT_TOKEN_REFRESH_WINDOW_MS;
  }
}

// Ignore the expiry from the JWT - use 1 year expiry instead - disables token
// refreshing - debug/compat usage only!
const DEFAULT_IGNORE_TOKEN_EXP = false;

/**
 * @returns Flag indicating to spoof/ignore the token expiry if present - if
 * True then the expiry will be ignored from any JWT intercepted, and set for 1
 * year. Must === true (case insensitive).
 */
function ignoreTokenExp(): boolean {
  const ignoreTokenExp = import.meta.env.VITE_IGNORE_TOKEN_EXP;
  if (ignoreTokenExp === '' || ignoreTokenExp === undefined) {
    return DEFAULT_IGNORE_TOKEN_EXP;
  }
  return ignoreTokenExp.toUpperCase() === 'TRUE';
}

/**
 * Map source configuration.  Define the map source
 * (see src/gui/components/map/tile_source.ts for options)
 * and the map key if required.
 */

function get_map_source(): string {
  const map_source = import.meta.env.VITE_MAP_SOURCE;
  return map_source || 'osm';
}

function get_map_key(): string {
  const map_key = import.meta.env.VITE_MAP_SOURCE_KEY;
  return map_key || '';
}

function offline_maps(): boolean {
  const offline_maps = import.meta.env.VITE_OFFLINE_MAPS === 'true';
  const map_source = get_map_source();
  console.log('OFFLINE_MAPS', offline_maps);
  // OSM does not allow bulk downloads so we can't enable offline maps
  return (offline_maps && map_source !== 'osm') || false;
}

// this should disappear once we have listing activation set up
export const AUTOACTIVATE_LISTINGS = true;
export const CONDUCTOR_URLS = get_conductor_urls();
export const DEBUG_POUCHDB = include_pouchdb_debugging();
export const DEBUG_APP = include_app_debugging();
export const DIRECTORY_AUTH = directory_auth();
export const RUNNING_UNDER_TEST = is_testing();
export const COMMIT_VERSION = commit_version();
export const POUCH_BATCH_SIZE = pouch_batch_size();
export const POUCH_BATCHES_LIMIT = pouch_batches_limit();
export const CLUSTER_ADMIN_GROUP_NAME = cluster_admin_group_name();
export const SHOW_MINIFAUXTON = show_minifauxton();
export const SHOW_WIPE = show_wipe();
export const SHOW_NEW_NOTEBOOK = show_new_notebook();
export const BUGSNAG_KEY = get_bugsnag_key();
export const NOTEBOOK_LIST_TYPE = get_notebook_list_type();
export const NOTEBOOK_NAME = get_notebook_name();
export const NOTEBOOK_NAME_CAPITALIZED = get_notebook_name_capitalized();
export const APP_NAME = get_app_name();
export const HEADING_APP_NAME = get_heading_app_name();
export const APP_ID = get_app_id();
export const SHOW_RECORD_SUMMARY_COUNTS = showRecordCounts();
export const TOKEN_REFRESH_INTERVAL_MS = tokenRefreshIntervalMs();
export const TOKEN_REFRESH_WINDOW_MS = tokenRefreshWindowMs();
export const IGNORE_TOKEN_EXP = ignoreTokenExp();
export const OFFLINE_MAPS = offline_maps();
export const MAP_SOURCE_KEY = get_map_key();
export const MAP_SOURCE = get_map_source();
