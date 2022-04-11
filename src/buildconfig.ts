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

const TRUTHY_STRINGS = ['true', '1', 'on', 'yes'];
const FALSEY_STRINGS = ['false', '0', 'off', 'no'];

/*
 * This is designed to get useful commit information data from
 * environment variables for the testing server. While more sophisticated
 * iterations of this can use extra node modules to get git data directly,
 * passing environment variables seems like the safest first path.
 */

function commit_version(): string {
  const commitver = process.env.REACT_APP_COMMIT_VERSION;
  console.log('Commit version', commitver);
  if (
    commitver === '' ||
    commitver === undefined ||
    FALSEY_STRINGS.includes(commitver.toLowerCase())
  ) {
    return 'unknown dev';
  } else {
    return commitver;
  }
}

function prod_build(): boolean {
  const prodbuild = process.env.REACT_APP_PRODUCTION_BUILD;
  if (
    prodbuild === '' ||
    prodbuild === undefined ||
    TRUTHY_STRINGS.includes(prodbuild.toLowerCase())
  ) {
    return true;
  } else if (FALSEY_STRINGS.includes(prodbuild.toLowerCase())) {
    return false;
  } else {
    console.error('REACT_APP_PRODUCTION_BUILD badly defined, assuming false');
    return false;
  }
}
/*
 * This isn't exported, instead to help reduce the number of environment
 * variables to set to get a production build for real users. Can be used in the
 * rest of the configuartion.
 */
const PROD_BUILD = prod_build();

function use_real_data(): boolean {
  const userealdata = process.env.REACT_APP_USE_REAL_DATA;
  if (userealdata === '' || userealdata === undefined) {
    // By default we don't include dummy data now
    return true;
  }
  if (FALSEY_STRINGS.includes(userealdata.toLowerCase())) {
    return false;
  } else if (TRUTHY_STRINGS.includes(userealdata.toLowerCase())) {
    return true;
  } else {
    console.error('REACT_APP_USE_REAL_DATA badly defined, assuming false');
    return false;
  }
}

function include_pouchdb_debugging(): boolean {
  const debug_pouch = process.env.REACT_APP_DEBUG_POUCHDB;
  if (debug_pouch === '' || debug_pouch === undefined) {
    return true;
  }
  if (FALSEY_STRINGS.includes(debug_pouch.toLowerCase())) {
    return false;
  } else if (TRUTHY_STRINGS.includes(debug_pouch.toLowerCase())) {
    return true;
  } else {
    console.error('REACT_APP_DEBUG_POUCHDB badly defined, assuming false');
    return false;
  }
}

function include_app_debugging(): boolean {
  const debug_app = process.env.REACT_APP_DEBUG_APP;
  if (debug_app === '' || debug_app === undefined) {
    return true;
  }
  if (FALSEY_STRINGS.includes(debug_app.toLowerCase())) {
    return false;
  } else if (TRUTHY_STRINGS.includes(debug_app.toLowerCase())) {
    return true;
  } else {
    console.error('REACT_APP_DEBUG_APP badly defined, assuming true');
    return true;
  }
}

function directory_protocol(): string {
  const usehttps = process.env.REACT_APP_USE_HTTPS;
  if (PROD_BUILD) {
    return 'https';
  } else if (
    usehttps === '' ||
    usehttps === undefined ||
    FALSEY_STRINGS.includes(usehttps.toLowerCase())
  ) {
    return 'http';
  } else if (TRUTHY_STRINGS.includes(usehttps.toLowerCase())) {
    return 'https';
  } else {
    console.error('REACT_APP_USE_HTTPS badly defined, assuming false');
    return 'http';
  }
}

function directory_host(): string {
  const host = process.env.REACT_APP_DIRECTORY_HOST;
  if (host === '' || host === undefined) {
    return 'dev.db.faims.edu.au';
  }
  return host;
}

function directory_port(): number {
  const port = process.env.REACT_APP_DIRECTORY_PORT;
  if (port === '' || port === undefined) {
    if (PROD_BUILD) {
      return 443;
    }
    return 5984;
  }
  try {
    return parseInt(port);
  } catch (err) {
    console.error('Falling back to default port', err);
    return 5984;
  }
}

/*
 * See batch_size in https://pouchdb.com/api.html#replication
 */
function pouch_batch_size(): number {
  const pouch_batch_size = process.env.REACT_APP_POUCH_BATCH_SIZE;
  if (pouch_batch_size === '' || pouch_batch_size === undefined) {
    return 1000;
  }
  try {
    return parseInt(pouch_batch_size);
  } catch (err) {
    console.error('Falling back to default pouch_batch_size', err);
    return 1000;
  }
}

/*
 * See batches_limit in https://pouchdb.com/api.html#replication
 */
function pouch_batches_limit(): number {
  const pouch_batches_limit = process.env.REACT_APP_POUCH_BATCHES_LIMIT;
  if (pouch_batches_limit === '' || pouch_batches_limit === undefined) {
    return 10;
  }
  try {
    return parseInt(pouch_batches_limit);
  } catch (err) {
    console.error('Falling back to default pouch_batches_limit', err);
    return 10;
  }
}

function directory_auth(): undefined | {username: string; password: string} {
  // Used in the server, as opposed to COUCHDB_USER and PASSWORD for testing.
  const username = process.env.REACT_APP_DIRECTORY_USERNAME;
  const password = process.env.REACT_APP_DIRECTORY_PASSWORD;

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
  const jest_worker_is_running = process.env.JEST_WORKER_ID !== undefined;
  const jest_imported = typeof jest !== 'undefined';
  const test_node_env = process.env.NODE_ENV === 'test';
  return jest_worker_is_running || jest_imported || test_node_env;
}

function cluster_admin_group_name(): string {
  const name = process.env.REACT_APP_CLUSTER_ADMIN_GROUP_NAME;
  if (name === '' || name === undefined) {
    return 'cluster-admin';
  }
  return name;
}

export const USE_REAL_DATA = PROD_BUILD || use_real_data();
export const DEBUG_POUCHDB = !PROD_BUILD && include_pouchdb_debugging();
export const DEBUG_APP = !PROD_BUILD && include_app_debugging();
export const DIRECTORY_PROTOCOL = directory_protocol();
export const DIRECTORY_HOST = directory_host();
export const DIRECTORY_PORT = directory_port();
export const DIRECTORY_AUTH = directory_auth();
export const RUNNING_UNDER_TEST = is_testing();
export const COMMIT_VERSION = commit_version();
export const POUCH_BATCH_SIZE = pouch_batch_size();
export const POUCH_BATCHES_LIMIT = pouch_batches_limit();
export const CLUSTER_ADMIN_GROUP_NAME = cluster_admin_group_name();
export const AUTOACTIVATE_PROJECTS = true; // for alpha, beta will change this
