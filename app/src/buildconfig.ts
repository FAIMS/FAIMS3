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
 * Filename: reportWebVitals.ts
 * Description:
 *   This module exports the configuration of the build, including things like
 *   which server to use and whether to include test data
 */

import {BUILD_VERSION, BUILD_VERSION_DEFAULT} from './version';

// need to define a local logError here since logging.tsx imports this file
const logError = (err: any) => console.error(err);

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

function prod_build(): boolean {
  const productionBuild = import.meta.env.VITE_PRODUCTION_BUILD;
  if (
    productionBuild === '' ||
    productionBuild === undefined ||
    TRUTHY_STRINGS.includes(productionBuild.toLowerCase())
  ) {
    return true;
  } else if (FALSEY_STRINGS.includes(productionBuild.toLowerCase())) {
    return false;
  } else {
    logError('VITE_PRODUCTION_BUILD badly defined, assuming false');
    return false;
  }
}
/*
 * This isn't exported, instead to help reduce the number of environment
 * variables to set to get a production build for real users. Can be used in the
 * rest of the configuration.
 */
const PROD_BUILD = prod_build();

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

function directory_protocol(): string {
  const useHTTPS = import.meta.env.VITE_USE_HTTPS;
  if (PROD_BUILD) {
    return 'https';
  } else if (
    useHTTPS === '' ||
    useHTTPS === undefined ||
    FALSEY_STRINGS.includes(useHTTPS.toLowerCase())
  ) {
    return 'http';
  } else if (TRUTHY_STRINGS.includes(useHTTPS.toLowerCase())) {
    return 'https';
  } else {
    logError('VITE_USE_HTTPS badly defined, assuming false');
    return 'http';
  }
}

function directory_host(): string {
  const host = import.meta.env.VITE_DIRECTORY_HOST;
  if (host === '' || host === undefined) {
    return 'dev.db.faims.edu.au';
  }
  return host;
}

function directory_port(): number {
  const port = import.meta.env.VITE_DIRECTORY_PORT;
  if (port === '' || port === undefined) {
    if (PROD_BUILD) {
      return 443;
    }
    return 5984;
  }
  try {
    return parseInt(port);
  } catch (err) {
    logError(err);
    return 5984;
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

function disable_signin_redirect(): boolean {
  const disable_signin = import.meta.env.VITE_DISABLE_SIGNIN_REDIRECT;
  if (disable_signin === '' || disable_signin === undefined) {
    return false;
  }
  if (FALSEY_STRINGS.includes(disable_signin.toLowerCase())) {
    return false;
  } else if (TRUTHY_STRINGS.includes(disable_signin.toLowerCase())) {
    return true;
  } else {
    logError('VITE_DISABLE_SIGNIN_REDIRECT badly defined, assuming false');
    return false;
  }
}

function get_login_token(): string | undefined {
  const login_token = import.meta.env.VITE_LOGIN_TOKEN;
  if (login_token === '' || login_token === undefined) {
    return undefined;
  }
  if (PROD_BUILD) {
    logError('Production builds should not set login token, except under test');
  }
  return login_token;
}

// If VITE_BUGSNAG_KEY is not defined then we don't use Bugsnag
function get_bugsnag_key(): string | false {
  const bugsnag_key = import.meta.env.VITE_BUGSNAG_KEY;
  if (bugsnag_key === '' || bugsnag_key === undefined) {
    return false;
  }
  console.log('BK', bugsnag_key);
  return bugsnag_key;
}

// this should disappear once we have listing activation set up
export const AUTOACTIVATE_LISTINGS = true;

export const DEBUG_POUCHDB = include_pouchdb_debugging();
export const DEBUG_APP = include_app_debugging();
export const DIRECTORY_PROTOCOL = directory_protocol();
export const DIRECTORY_HOST = directory_host();
export const DIRECTORY_PORT = directory_port();
export const DIRECTORY_AUTH = directory_auth();
export const RUNNING_UNDER_TEST = is_testing();
export const COMMIT_VERSION = commit_version();
export const POUCH_BATCH_SIZE = pouch_batch_size();
export const POUCH_BATCHES_LIMIT = pouch_batches_limit();
export const CLUSTER_ADMIN_GROUP_NAME = cluster_admin_group_name();
export const SHOW_MINIFAUXTON = show_minifauxton();
export const SHOW_WIPE = show_wipe();
export const SHOW_NEW_NOTEBOOK = show_new_notebook();
export const DISABLE_SIGNIN_REDIRECT = disable_signin_redirect();
export const BUILT_LOGIN_TOKEN = get_login_token();
export const BUGSNAG_KEY = get_bugsnag_key();
