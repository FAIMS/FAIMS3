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

import {v4 as uuidv4} from 'uuid';
import {getKeyService, IKeyService, KeySource} from './services/keyService';
import nodemailer from 'nodemailer';

const TRUTHY_STRINGS = ['true', '1', 'on', 'yes'];
const FALSEY_STRINGS = ['false', '0', 'off', 'no'];

// If a URL for the conductor instance is not provided this will be used as a fall-through
const DEFAULT_CONDUCTOR_URL = 'http://localhost:8080';

/*
 * This is designed to get useful commit information data from
 * environment variables for the testing server. While more sophisticated
 * iterations of this can use extra node modules to get git data directly,
 * passing environment variables seems like the safest first path.
 */

function commit_version(): string {
  const commitver = process.env.COMMIT_VERSION;
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

/*
  conductor_url - returns the base URL of this Conductor server
*/
function conductor_url(): string {
  const url = process.env.CONDUCTOR_PUBLIC_URL;
  if (url === '' || url === undefined) {
    console.warn(
      `No value for CONDUCTOR_PUBLIC_URL was provided in the environment. Defaulting to ${DEFAULT_CONDUCTOR_URL}.`
    );
    return DEFAULT_CONDUCTOR_URL;
  } else {
    return url;
  }
}

function app_url(): string {
  const url = process.env.WEB_APP_PUBLIC_URL;
  if (url === '' || url === undefined) {
    return 'http://localhost:3000';
  }
  return url;
}

function android_url(): string {
  const url = process.env.ANDROID_APP_PUBLIC_URL;
  if (url === '' || url === undefined) {
    return 'http://localhost:3000';
  }
  return url;
}

function ios_url(): string {
  const url = process.env.IOS_APP_PUBLIC_URL;
  if (url === '' || url === undefined) {
    return 'http://localhost:3000';
  }
  return url;
}

function is_testing() {
  const jest_worker_is_running = process.env.JEST_WORKER_ID !== undefined;
  const jest_imported = false; //typeof jest !== 'undefined';
  const test_node_env = process.env.NODE_ENV === 'test';
  return jest_worker_is_running || jest_imported || test_node_env;
}

function couchdb_internal_url(): string {
  let couchdb = process.env.COUCHDB_INTERNAL_URL;
  const couchdbDefault = 'http://localhost:5984';
  if (couchdb === '' || couchdb === undefined) {
    console.log('COUCHDB_INTERNAL_URL not set, using default');
    return couchdbDefault;
  } else {
    if (couchdb.endsWith('/')) {
      console.log('COUCHDB_URL should not end with / - removing it');
      couchdb = couchdb.substring(0, couchdb.length - 1);
    }
    return couchdb;
  }
}

function couchdb_public_url(): string {
  let couchdb = process.env.COUCHDB_PUBLIC_URL;
  const couchdbDefault = 'http://localhost:5984';
  if (couchdb === '' || couchdb === undefined) {
    console.log('COUCHDB_PUBLIC_URL not set, using default');
    return couchdbDefault;
  } else {
    if (couchdb.endsWith('/')) {
      console.log('COUCHDB_PUBLIC_URL should not end with / - removing it');
      couchdb = couchdb.substring(0, couchdb.length - 1);
    }
    return couchdb;
  }
}

function local_couchdb_auth():
  | undefined
  | {username: string; password: string} {
  // Used in the server, as opposed to COUCHDB_USER and PASSWORD for testing.
  const username = process.env.COUCHDB_USER;
  const password = process.env.COUCHDB_PASSWORD;

  if (
    username === '' ||
    username === undefined ||
    password === '' ||
    password === undefined
  ) {
    console.warn('Falling back to default local couchdb auth');
    return {username: 'admin', password: 'password'};
  } else {
    return {username: username, password: password};
  }
}

function signing_key_id(): string {
  const key_id = process.env.PROFILE_NAME;
  if (key_id === '' || key_id === undefined) {
    console.log('PROFILE_NAME not set, using default for signing key');
    return 'test';
  } else {
    return key_id;
  }
}

// Generate public and private keys file names in the same way as makeInstanceKeys.sh

function private_key_path(): string {
  let host = process.env.PROFILE_NAME;
  if (host === '' || host === undefined) {
    host = 'conductor';
  }
  return `keys/${host}_private_key.pem`;
}

function public_key_path(): string {
  let host = process.env.PROFILE_NAME;
  if (host === '' || host === undefined) {
    host = 'conductor';
  }
  return `keys/${host}_public_key.pem`;
}

function instance_name(): string {
  const name = process.env.CONDUCTOR_INSTANCE_NAME;
  if (name === '' || name === undefined) {
    console.log(
      'CONDUCTOR_INSTANCE_NAME not set, using PROFILE_NAME for instance name'
    );
    return signing_key_id();
  } else {
    return name;
  }
}

function short_code_prefix(): string {
  const prefix = process.env.CONDUCTOR_SHORT_CODE_PREFIX;
  if (prefix === '' || prefix === undefined) {
    console.log(
      'CONDUCTOR_SHORT_CODE_PREFIX not set, using "FAIMS" as default'
    );
    return 'FAIMS';
  } else {
    return prefix;
  }
}

function instance_description(): string {
  const name = process.env.CONDUCTOR_DESCRIPTION;
  if (name === '' || name === undefined) {
    return 'Fieldmark Conductor Server';
  } else {
    return name;
  }
}

function cookie_secret(): string {
  const cookie = process.env.FAIMS_COOKIE_SECRET;
  if (cookie === '' || cookie === undefined) {
    console.log('FAIMS_COOKIE_SECRET not set, using generated secret');
    return uuidv4();
  } else {
    return cookie;
  }
}

function google_client_id(): string {
  const s = process.env.GOOGLE_CLIENT_ID;
  if (s === '' || s === undefined) {
    console.log('GOOGLE_CLIENT_ID not set, setting empty');
    return '';
  } else {
    return s;
  }
}

function google_client_secret(): string {
  const s = process.env.GOOGLE_CLIENT_SECRET;
  if (s === '' || s === undefined) {
    console.log('GOOGLE_CLIENT_SECRET not set, setting empty');
    return '';
  } else {
    return s;
  }
}

function get_providers_to_use(): string[] {
  const providers = process.env.CONDUCTOR_AUTH_PROVIDERS;
  if (providers === '' || providers === undefined) {
    console.log('CONDUCTOR_AUTH_PROVIDERS not set, defaulting to empty');
    return [];
  }
  return providers.split(';');
}

function conductor_internal_port(): number {
  const port = process.env.CONDUCTOR_INTERNAL_PORT;
  if (port === '' || port === undefined) {
    return 8000;
  }
  return parseInt(port);
}

function email_from_address(): string {
  const hostname = process.env.CONDUCTOR_EMAIL_FROM_ADDRESS;
  if (hostname === '' || hostname === undefined) {
    throw Error(
      'CONDUCTOR_EMAIL_FROM_ADDRESS must be set to send email invites'
    );
  }
  return hostname;
}

function email_transporter(): any {
  const config = process.env.CONDUCTOR_EMAIL_HOST_CONFIG;
  if (config === '' || config === undefined) {
    throw Error(
      'CONDUCTOR_EMAIL_HOST_CONFIG must be set to send email invites'
    );
  }
  return nodemailer.createTransport(config);
}

function developer_mode(): any {
  const develop = process.env.DEVELOPER_MODE;
  if (develop) {
    return TRUTHY_STRINGS.includes(develop?.toLowerCase());
  } else {
    return false;
  }
}

/**
 * Retrieves the configured app identifier for Android/IOS
 * @returns {string} - the app id
 */
function get_app_id(): string {
  const appid = process.env.APP_ID;
  return appid || 'org.fedarch.faims3';
}

export const DEVELOPER_MODE = developer_mode();
export const COUCHDB_INTERNAL_URL = couchdb_internal_url();
export const COUCHDB_PUBLIC_URL = couchdb_public_url();
export const LOCAL_COUCHDB_AUTH = local_couchdb_auth();
export const RUNNING_UNDER_TEST = is_testing();
export const COMMIT_VERSION = commit_version();
export const CONDUCTOR_PUBLIC_URL = conductor_url();
export const CONDUCTOR_INTERNAL_PORT = conductor_internal_port();
export const CONDUCTOR_KEY_ID = signing_key_id();
export const CONDUCTOR_PRIVATE_KEY_PATH = private_key_path();
export const CONDUCTOR_PUBLIC_KEY_PATH = public_key_path();
export const CONDUCTOR_INSTANCE_NAME = instance_name();
export const CONDUCTOR_SHORT_CODE_PREFIX = short_code_prefix();
export const CONDUCTOR_DESCRIPTION = instance_description();
export const COOKIE_SECRET = cookie_secret();
export const GOOGLE_CLIENT_ID = google_client_id();
export const GOOGLE_CLIENT_SECRET = google_client_secret();
export const CONDUCTOR_AUTH_PROVIDERS = get_providers_to_use();
export const EMAIL_FROM_ADDRESS = email_from_address();
export const EMAIL_TRANSPORTER = email_transporter();
export const WEBAPP_PUBLIC_URL = app_url();
export const ANDROID_APP_URL = android_url();
export const IOS_APP_URL = ios_url();
export const APP_ID = get_app_id();

/**
 * Checks the KEY_SOURCE env variable to ensure its a KEY_SOURCE or defaults to
 * FILE.
 * @returns the KeySource enum to use
 */
function getKeySourceConfig(): KeySource {
  const keySource = process.env.KEY_SOURCE as KeySource;
  if (keySource === undefined || !(keySource in KeySource)) {
    console.log('KEY_SOURCE not set or invalid, using default FILE');
    return KeySource.FILE;
  }
  return keySource;
}

function getAwsSecretKeyArn(): string {
  const arn = process.env.AWS_SECRET_KEY_ARN;
  if (!arn) {
    throw new Error('AWS_SECRET_KEY_ARN is not set but KEY_SOURCE is AWS_SM');
  }
  return arn;
}

// Dependency injection pattern for key service
export const KEY_SOURCE: KeySource = getKeySourceConfig();
export const AWS_SECRET_KEY_ARN: string | undefined =
  KEY_SOURCE === KeySource.AWS_SM ? getAwsSecretKeyArn() : undefined;

export const KEY_SERVICE: IKeyService = getKeyService(KEY_SOURCE);
