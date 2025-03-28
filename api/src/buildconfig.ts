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

import {existsSync} from 'fs';
import {v4 as uuidv4} from 'uuid';
import {
  createEmailService,
  EmailConfig,
  EmailServiceType,
  IEmailService,
  SMTPEmailServiceConfig,
} from './services/emailService';
import {getKeyService, IKeyService, KeySource} from './services/keyService';

const TRUTHY_STRINGS = ['true', '1', 'on', 'yes'];

// If a URL for the conductor instance is not provided this will be used as a fall-through
const DEFAULT_CONDUCTOR_URL = 'http://localhost:8080';

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
  return url || '';
}

function ios_url(): string {
  const url = process.env.IOS_APP_PUBLIC_URL;
  return url || '';
}

function designer_url(): string {
  const url = process.env.DESIGNER_URL;
  return url || '';
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

function key_file_path(): string {
  const path = process.env.KEY_FILE_PATH;
  if (path === '' || path === undefined) {
    console.log('KEY_FILE_PATH not set, using default');
    return '.';
  } else {
    if (existsSync(path)) {
      return path;
    } else {
      console.log('KEY_FILE_PATH does not exist, using default');
      return '.';
    }
  }
}

export function private_key_path(): string {
  let host = process.env.PROFILE_NAME;
  if (host === '' || host === undefined) {
    host = 'conductor';
  }
  const path = key_file_path();
  const keyfile = `${path}/keys/${host}_private_key.pem`;
  if (existsSync(keyfile)) {
    console.log(`Private key file ${keyfile} exists.`);
    return keyfile;
  } else {
    throw new Error(
      `Private key file ${keyfile} does not exist. Please run makeInstanceKeys.sh to generate keys.`
    );
  }
}

export function public_key_path(): string {
  let host = process.env.PROFILE_NAME;
  if (host === '' || host === undefined) {
    host = 'conductor';
  }
  const path = key_file_path();
  const keyfile = `${path}/keys/${host}_public_key.pem`;
  if (existsSync(keyfile)) {
    console.log(`Public key file ${keyfile} exists.`);
    return keyfile;
  } else {
    throw new Error(
      `Public key file ${keyfile} does not exist. Please run makeInstanceKeys.sh to generate keys.`
    );
  }
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

function developer_mode(): any {
  const develop = process.env.DEVELOPER_MODE;
  if (develop) {
    return TRUTHY_STRINGS.includes(develop?.toLowerCase());
  } else {
    return false;
  }
}

// 5 minute access token expiry by default
const DEFAULT_ACCESS_TOKEN_EXPIRY_MINUTES = 5;

/**
 * @returns The minimum valid time for a token before attempting refreshes
 */
function accessTokenExpiryMinutes(): number {
  const accessTokenExpiryMinutes = process.env.ACCESS_TOKEN_EXPIRY_MINUTES;
  if (
    accessTokenExpiryMinutes === '' ||
    accessTokenExpiryMinutes === undefined
  ) {
    return DEFAULT_ACCESS_TOKEN_EXPIRY_MINUTES;
  }
  try {
    return parseInt(accessTokenExpiryMinutes);
  } catch (err) {
    console.error(
      'ACCESS_TOKEN_EXPIRY_MINUTES unparseable, defaulting to ' +
        DEFAULT_ACCESS_TOKEN_EXPIRY_MINUTES
    );
    return DEFAULT_ACCESS_TOKEN_EXPIRY_MINUTES;
  }
}

// 2 days refresh token expiry by default
const DEFAULT_REFRESH_TOKEN_EXPIRY_MINUTES = 60 * 24 * 2;

/**
 * @returns The minimum valid time for a token before attempting refreshes
 */
function refreshTokenExpiryMinutes(): number {
  const refreshTokenExpiryMinutes = process.env.REFRESH_TOKEN_EXPIRY_MINUTES;
  if (
    refreshTokenExpiryMinutes === '' ||
    refreshTokenExpiryMinutes === undefined
  ) {
    return DEFAULT_REFRESH_TOKEN_EXPIRY_MINUTES;
  }
  try {
    return parseInt(refreshTokenExpiryMinutes);
  } catch (err) {
    console.error(
      'REFRESH_TOKEN_EXPIRY_MINUTES unparseable, defaulting to ' +
        DEFAULT_REFRESH_TOKEN_EXPIRY_MINUTES
    );
    return DEFAULT_REFRESH_TOKEN_EXPIRY_MINUTES;
  }
}

// 30 minute default expiry for email verification codes
const DEFAULT_EMAIL_CODE_EXPIRY_MINUTES = 30;

/**
 * @returns The expiry time in minutes for email verification codes
 */
function emailCodeExpiryMinutes(): number {
  const emailCodeExpiryMinutes = process.env.EMAIL_CODE_EXPIRY_MINUTES;
  if (emailCodeExpiryMinutes === '' || emailCodeExpiryMinutes === undefined) {
    return DEFAULT_EMAIL_CODE_EXPIRY_MINUTES;
  }
  try {
    return parseInt(emailCodeExpiryMinutes);
  } catch (err) {
    console.error(
      'EMAIL_CODE_EXPIRY_MINUTES unparseable, defaulting to ' +
        DEFAULT_EMAIL_CODE_EXPIRY_MINUTES
    );
    return DEFAULT_EMAIL_CODE_EXPIRY_MINUTES;
  }
}

const DEFAULT_RATE_LIMITER_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_RATE_LIMITER_PER_WINDOW = 1000; // 1000 requests per window
const DEFAULT_RATE_LIMITER_ENABLED = true;

/**
 * Gets the rate limiter window duration in milliseconds from environment variables
 * @returns The window duration in milliseconds
 */
function rateLimiterWindowMs(): number {
  const rateLimiterWindowMs = process.env.RATE_LIMITER_WINDOW_MS;
  if (rateLimiterWindowMs === '' || rateLimiterWindowMs === undefined) {
    return DEFAULT_RATE_LIMITER_WINDOW_MS;
  }
  try {
    return parseInt(rateLimiterWindowMs);
  } catch (err) {
    console.error(
      'RATE_LIMITER_WINDOW_MS unparseable, defaulting to ' +
        DEFAULT_RATE_LIMITER_WINDOW_MS
    );
    return DEFAULT_RATE_LIMITER_WINDOW_MS;
  }
}

/**
 * Gets the number of requests allowed per window from environment variables
 * @returns The number of requests allowed per window
 */
function rateLimiterPerWindow(): number {
  const rateLimiterPerWindow = process.env.RATE_LIMITER_PER_WINDOW;
  if (rateLimiterPerWindow === '' || rateLimiterPerWindow === undefined) {
    return DEFAULT_RATE_LIMITER_PER_WINDOW;
  }
  try {
    return parseInt(rateLimiterPerWindow);
  } catch (err) {
    console.error(
      'RATE_LIMITER_PER_WINDOW unparseable, defaulting to ' +
        DEFAULT_RATE_LIMITER_PER_WINDOW
    );
    return DEFAULT_RATE_LIMITER_PER_WINDOW;
  }
}

/**
 * Checks if rate limiting is enabled from environment variables
 * @returns Boolean indicating if rate limiting is enabled
 */
function rateLimiterEnabled(): boolean {
  const rateLimiterEnabled = process.env.RATE_LIMITER_ENABLED;
  if (rateLimiterEnabled === undefined) {
    return DEFAULT_RATE_LIMITER_ENABLED;
  }
  return rateLimiterEnabled.toLowerCase() === 'true';
}

/**
 * What is the URL of the new conductor? Required.
 *
 * @returns The new conductor URL, no trailing /
 */
function newConductorUrl(): string {
  let conductorUrl = process.env.NEW_CONDUCTOR_URL;
  if (conductorUrl === '' || conductorUrl === undefined) {
    throw Error('You must provide a NEW_CONDUCTOR_URL in your environment.');
  } else {
    if (conductorUrl.endsWith('/')) {
      console.log('NEW_CONDUCTOR_URL should not end with / - removing it');
      conductorUrl = conductorUrl.substring(0, conductorUrl.length - 1);
    }
    return conductorUrl;
  }
}

export const DEVELOPER_MODE = developer_mode();
export const COUCHDB_INTERNAL_URL = couchdb_internal_url();
export const COUCHDB_PUBLIC_URL = couchdb_public_url();
export const LOCAL_COUCHDB_AUTH = local_couchdb_auth();
export const RUNNING_UNDER_TEST = is_testing();
export const CONDUCTOR_PUBLIC_URL = conductor_url();
export const CONDUCTOR_INTERNAL_PORT = conductor_internal_port();
export const CONDUCTOR_KEY_ID = signing_key_id();
export const CONDUCTOR_INSTANCE_NAME = instance_name();
export const CONDUCTOR_SHORT_CODE_PREFIX = short_code_prefix();
export const CONDUCTOR_DESCRIPTION = instance_description();
export const COOKIE_SECRET = cookie_secret();
export const GOOGLE_CLIENT_ID = google_client_id();
export const GOOGLE_CLIENT_SECRET = google_client_secret();
export const CONDUCTOR_AUTH_PROVIDERS = get_providers_to_use();
export const WEBAPP_PUBLIC_URL = app_url();
export const ANDROID_APP_URL = android_url();
export const IOS_APP_URL = ios_url();
export const ACCESS_TOKEN_EXPIRY_MINUTES = accessTokenExpiryMinutes();
export const REFRESH_TOKEN_EXPIRY_MINUTES = refreshTokenExpiryMinutes();
export const DESIGNER_URL = designer_url();
export const RATE_LIMITER_WINDOW_MS = rateLimiterWindowMs();
export const RATE_LIMITER_PER_WINDOW = rateLimiterPerWindow();
export const RATE_LIMITER_ENABLED = rateLimiterEnabled();
export const EMAIL_CODE_EXPIRY_MINUTES = emailCodeExpiryMinutes();
export const NEW_CONDUCTOR_URL = newConductorUrl();

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

/**
 * Determines which email service type to use based on environment variables.
 * @returns The email service type.
 */
function getEmailServiceType(): EmailServiceType {
  const emailServiceType = process.env.EMAIL_SERVICE_TYPE as EmailServiceType;

  if (is_testing()) {
    console.log('Since we are testing, using mock email service.');
    return EmailServiceType.MOCK;
  }

  if (
    emailServiceType === undefined ||
    !(emailServiceType in EmailServiceType)
  ) {
    // Otherwise default to SMTP
    console.log(
      'EMAIL_SERVICE_TYPE not set or invalid, using default SMTP - configuration may not be available depending on your environment. Please explicitly configure SMTP if this is the preferred behaviour.'
    );
    return EmailServiceType.SMTP;
  }

  return emailServiceType;
}

const DEFAULT_FROM_EMAIL = 'noreply@example.com';
const DEFAULT_FROM_NAME = 'FAIMS System Notification';

/**
 * Gets the email configuration from environment variables.
 * @returns The email configuration.
 */
function getEmailConfig(): EmailConfig {
  const fromEmail = process.env.EMAIL_FROM_ADDRESS;
  const fromName = process.env.EMAIL_FROM_NAME;
  const replyTo = process.env.EMAIL_REPLY_TO;

  if (!fromEmail || !fromName) {
    console.warn('Email configuration is incomplete. Using default values.');
    return {
      fromEmail: fromEmail || DEFAULT_FROM_EMAIL,
      fromName: fromName || DEFAULT_FROM_NAME,
      replyTo: replyTo,
    };
  }

  return {
    fromEmail,
    fromName,
    replyTo,
  };
}

/**
 * Gets the SMTP configuration from environment variables.
 * @returns The SMTP configuration.
 */
function getSMTPConfig(): SMTPEmailServiceConfig {
  const host = process.env.SMTP_HOST;
  const portStr = process.env.SMTP_PORT;
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const cacheExpirySecondsStr = process.env.SMTP_CACHE_EXPIRY_SECONDS;

  // Check for missing configuration and provide detailed error message
  const missingConfig = [];
  if (!host) missingConfig.push('SMTP_HOST');
  if (!portStr) missingConfig.push('SMTP_PORT');
  if (!user) missingConfig.push('SMTP_USER');
  if (!pass) missingConfig.push('SMTP_PASSWORD');

  if (missingConfig.length > 0) {
    const providedConfig = {
      SMTP_HOST: host || '[missing]',
      SMTP_PORT: portStr || '[missing]',
      SMTP_SECURE: secure.toString(),
      SMTP_USER: user ? '[provided]' : '[missing]',
      SMTP_PASSWORD: pass ? '[provided]' : '[missing]',
      SMTP_CACHE_EXPIRY_SECONDS: cacheExpirySecondsStr || '[using default]',
    };

    throw new Error(
      `SMTP configuration is incomplete. Missing required values: ${missingConfig.join(', ')}.\n` +
        `Provided configuration: ${JSON.stringify(providedConfig, null, 2)}`
    );
  }

  const port = parseInt(portStr!);
  const cacheExpirySeconds = cacheExpirySecondsStr
    ? parseInt(cacheExpirySecondsStr)
    : 300;

  return {
    host: host!,
    port,
    secure,
    auth: {
      user: user!,
      pass: pass!,
    },
    cacheExpirySeconds,
  };
}

export const EMAIL_SERVICE_TYPE = getEmailServiceType();
export const EMAIL_CONFIG = getEmailConfig();
export const SMTP_CONFIG = getSMTPConfig();
export const EMAIL_SERVICE: IEmailService = createEmailService({
  serviceType: EMAIL_SERVICE_TYPE,
  emailConfig: EMAIL_CONFIG,
  serviceConfig:
    EMAIL_SERVICE_TYPE === EmailServiceType.SMTP ? SMTP_CONFIG : undefined,
});

/**
 * Gets the test email address configuration from environment variables.
 * @returns The test email address.
 * @throws Error if test email address is not configured.
 */
function getTestEmailAddress(): string {
  const testEmailAddress = process.env.TEST_EMAIL_ADDRESS;
  
  if (!testEmailAddress) {
    throw new Error(
      'TEST_EMAIL_ADDRESS environment variable is required for testing email functionality. ' +
      'Please add this to your environment configuration.'
    );
  }
  
  return testEmailAddress;
}

// Export the test email address
export const TEST_EMAIL_ADDRESS = getTestEmailAddress();