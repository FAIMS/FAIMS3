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
 *   Configuration is parsed from the environment using a two-pass zod pipeline:
 *     - Pass one (EnvSchema) validates/narrows the raw environment into strings.
 *     - Pass two (ConfigSchema + a small amount of custom logic for values that
 *       depend on each other, are required, or construct service instances)
 *       produces the typed, frozen `config` singleton exported below.
 *
 *   Prefer importing `{config}` and reading `config.<field>`. A handful of
 *   values that are not simple env scalars (service singletons, key-file paths,
 *   the package version and derived server id) remain as dedicated exports.
 */

import {slugify} from '@faims3/data-model';
import {existsSync} from 'fs';
import {z} from 'zod';
import {
  createEmailService,
  EmailConfig,
  EmailServiceType,
  IEmailService,
  SMTPEmailServiceConfig,
} from './services/emailService';
import {getKeyService, IKeyService, KeySource} from './services/keyService';

// Get the package version directly from package.json
import {version as packageVersion} from '../package.json';
import {
  ProvisionSSOUsersPolicy,
  ProvisionSSOUsersPolicySchema,
} from './auth/types';

console.log(`Using API version from package.json: ${packageVersion}`);
export const API_VERSION = packageVersion;

const TRUTHY_STRINGS = ['true', '1', 'on', 'yes'];

// If a URL for the conductor instance is not provided this will be used as a fall-through
const DEFAULT_CONDUCTOR_URL = 'http://localhost:8080';
const DEFAULT_COUCHDB_URL = 'http://localhost:5984';
const DEFAULT_WEBAPP_URL = 'http://localhost:3000';

// 5 minute access token expiry by default
const DEFAULT_ACCESS_TOKEN_EXPIRY_MINUTES = 5;
// 2 days refresh token expiry by default
const DEFAULT_REFRESH_TOKEN_EXPIRY_MINUTES = 60 * 24 * 2;
// 30 minute default expiry for email verification codes
const DEFAULT_EMAIL_CODE_EXPIRY_MINUTES = 30;
const DEFAULT_RATE_LIMITER_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_RATE_LIMITER_PER_WINDOW = 1000; // 1000 requests per window
const DEFAULT_MAXIMUM_LONG_LIVED_DURATION_DAYS = 90;

const DEFAULT_FROM_EMAIL = 'noreply@example.com';
const DEFAULT_FROM_NAME = 'FAIMS System Notification';

// ---------------------------------------------------------------------------
// Pass one: read and validate the raw environment into (optional) strings.
// ---------------------------------------------------------------------------

const EnvSchema = z.object({
  CONDUCTOR_PUBLIC_URL: z.string().optional(),
  WEB_APP_PUBLIC_URL: z.string().optional(),
  ANDROID_APP_PUBLIC_URL: z.string().optional(),
  IOS_APP_PUBLIC_URL: z.string().optional(),
  DESIGNER_URL: z.string().optional(),
  COUCHDB_INTERNAL_URL: z.string().optional(),
  COUCHDB_PUBLIC_URL: z.string().optional(),
  COUCHDB_USER: z.string().optional(),
  COUCHDB_PASSWORD: z.string().optional(),
  PROFILE_NAME: z.string().optional(),
  KEY_FILE_PATH: z.string().optional(),
  CONDUCTOR_INSTANCE_NAME: z.string().optional(),
  CONDUCTOR_SHORT_CODE_PREFIX: z.string().optional(),
  CONDUCTOR_DESCRIPTION: z.string().optional(),
  FAIMS_COOKIE_SECRET: z.string().optional(),
  CONDUCTOR_INTERNAL_PORT: z.string().optional(),
  DEVELOPER_MODE: z.string().optional(),
  PROVISION_SSO_USERS_POLICY: z.string().optional(),
  ACCESS_TOKEN_EXPIRY_MINUTES: z.string().optional(),
  REFRESH_TOKEN_EXPIRY_MINUTES: z.string().optional(),
  EMAIL_CODE_EXPIRY_MINUTES: z.string().optional(),
  RATE_LIMITER_WINDOW_MS: z.string().optional(),
  RATE_LIMITER_PER_WINDOW: z.string().optional(),
  RATE_LIMITER_ENABLED: z.string().optional(),
  NEW_CONDUCTOR_URL: z.string().optional(),
  DISABLE_LOCAL_LOGIN: z.string().optional(),
  MIGRATE_NOTEBOOKS_ON_STARTUP: z.string().optional(),
  KEY_SOURCE: z.string().optional(),
  AWS_SECRET_KEY_ARN: z.string().optional(),
  EMAIL_SERVICE_TYPE: z.string().optional(),
  EMAIL_FROM_ADDRESS: z.string().optional(),
  EMAIL_FROM_NAME: z.string().optional(),
  EMAIL_REPLY_TO: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_SECURE: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_CACHE_EXPIRY_SECONDS: z.string().optional(),
  TEST_EMAIL_ADDRESS: z.string().optional(),
  REDIRECT_WHITELIST: z.string().optional(),
  MAXIMUM_LONG_LIVED_DURATION_DAYS: z.string().optional(),
  BUGSNAG_API_KEY: z.string().optional(),
  JEST_WORKER_ID: z.string().optional(),
  NODE_ENV: z.string().optional(),
});

type RawEnv = z.infer<typeof EnvSchema>;

const rawEnv: RawEnv = EnvSchema.parse(process.env);

// ---------------------------------------------------------------------------
// Reusable pass-two field builders.
// ---------------------------------------------------------------------------

const isBlank = (v: string | undefined): v is undefined | '' =>
  v === undefined || v === '';

/** A required non-empty string default, no logging. */
const stringFromEnv = (def: string) =>
  z.string().optional().transform(v => (isBlank(v) ? def : v));

/** Integer with default; unparseable/blank falls back to the default. */
const intFromEnv = (def: number, label?: string) =>
  z.string()
    .optional()
    .transform(v => {
      if (isBlank(v)) return def;
      const parsed = parseInt(v, 10);
      if (Number.isNaN(parsed)) {
        if (label) console.error(`${label} unparseable, defaulting to ${def}`);
        return def;
      }
      return parsed;
    });

/** Boolean where any of the truthy strings (case-insensitive) means true. */
const truthyBool = (def: boolean) =>
  z.string()
    .optional()
    .transform(v => (isBlank(v) ? def : TRUTHY_STRINGS.includes(v.toLowerCase())));

/**
 * Boolean where only the exact (case-insensitive) string 'true' means true.
 * A blank/undefined value falls back to the provided default.
 */
const equalsTrueBool = (def: boolean) =>
  z.string()
    .optional()
    .transform(v => (v === undefined ? def : v.toLowerCase() === 'true'));

// ---------------------------------------------------------------------------
// Pass two: build the typed configuration values.
// ---------------------------------------------------------------------------

const ConfigSchema = z.object({
  conductorPublicUrl: z
    .string()
    .optional()
    .transform(v => {
      if (isBlank(v)) {
        console.warn(
          `No value for CONDUCTOR_PUBLIC_URL was provided in the environment. Defaulting to ${DEFAULT_CONDUCTOR_URL}.`
        );
        return DEFAULT_CONDUCTOR_URL;
      }
      return v;
    }),
  webAppPublicUrl: stringFromEnv(DEFAULT_WEBAPP_URL),
  androidAppUrl: stringFromEnv(''),
  iosAppUrl: stringFromEnv(''),
  designerUrl: stringFromEnv(''),
  couchdbInternalUrl: z
    .string()
    .optional()
    .transform(v => {
      if (isBlank(v)) {
        console.log('COUCHDB_INTERNAL_URL not set, using default');
        return DEFAULT_COUCHDB_URL;
      }
      if (v.endsWith('/')) {
        console.log('COUCHDB_URL should not end with / - removing it');
        return v.substring(0, v.length - 1);
      }
      return v;
    }),
  couchdbPublicUrl: z
    .string()
    .optional()
    .transform(v => {
      if (isBlank(v)) {
        console.log('COUCHDB_PUBLIC_URL not set, using default');
        return DEFAULT_COUCHDB_URL;
      }
      if (v.endsWith('/')) {
        console.log('COUCHDB_PUBLIC_URL should not end with / - removing it');
        return v.substring(0, v.length - 1);
      }
      return v;
    }),
  conductorKeyId: z
    .string()
    .optional()
    .transform(v => {
      if (isBlank(v)) {
        console.log('PROFILE_NAME not set, using default for signing key');
        return 'test';
      }
      return v;
    }),
  keyFilePath: z
    .string()
    .optional()
    .transform(v => {
      if (isBlank(v)) {
        console.log('KEY_FILE_PATH not set, using default');
        return '.';
      }
      if (existsSync(v)) return v;
      console.log('KEY_FILE_PATH does not exist, using default');
      return '.';
    }),
  shortCodePrefix: z
    .string()
    .optional()
    .transform(v => {
      if (isBlank(v)) {
        console.log(
          'CONDUCTOR_SHORT_CODE_PREFIX not set, using "FAIMS" as default'
        );
        return 'FAIMS';
      }
      return v;
    }),
  instanceDescription: stringFromEnv('Fieldmark Conductor Server'),
  cookieSecret: z
    .string()
    .optional()
    .transform(v => {
      if (isBlank(v)) {
        console.log('FAIMS_COOKIE_SECRET not set, using generated secret');
        return crypto.randomUUID();
      }
      return v;
    }),
  conductorInternalPort: intFromEnv(8000),
  developerMode: truthyBool(false),
  provisionSSOUsersPolicy: z
    .string()
    .optional()
    .transform((v): ProvisionSSOUsersPolicy => {
      if (v) {
        const result = ProvisionSSOUsersPolicySchema.safeParse(v);
        if (result.success) return result.data;
        console.error(
          `Invalid PROVISION_SSO_USERS_POLICY value: ${v}, defaulting to 'reject'`
        );
      }
      // default policy is 'reject' which rejects unknown users via SSO
      return 'reject';
    }),
  accessTokenExpiryMinutes: intFromEnv(
    DEFAULT_ACCESS_TOKEN_EXPIRY_MINUTES,
    'ACCESS_TOKEN_EXPIRY_MINUTES'
  ),
  refreshTokenExpiryMinutes: intFromEnv(
    DEFAULT_REFRESH_TOKEN_EXPIRY_MINUTES,
    'REFRESH_TOKEN_EXPIRY_MINUTES'
  ),
  emailCodeExpiryMinutes: intFromEnv(
    DEFAULT_EMAIL_CODE_EXPIRY_MINUTES,
    'EMAIL_CODE_EXPIRY_MINUTES'
  ),
  rateLimiterWindowMs: intFromEnv(
    DEFAULT_RATE_LIMITER_WINDOW_MS,
    'RATE_LIMITER_WINDOW_MS'
  ),
  rateLimiterPerWindow: intFromEnv(
    DEFAULT_RATE_LIMITER_PER_WINDOW,
    'RATE_LIMITER_PER_WINDOW'
  ),
  rateLimiterEnabled: equalsTrueBool(true),
  migrateNotebooksOnStartup: equalsTrueBool(true),
  keySource: z
    .string()
    .optional()
    .transform((v): KeySource => {
      if (v === undefined || !(v in KeySource)) {
        console.log('KEY_SOURCE not set or invalid, using default FILE');
        return KeySource.FILE;
      }
      return v as KeySource;
    }),
  maximumLongLivedDurationDays: z
    .string()
    .optional()
    .transform((v): number | undefined => {
      if (isBlank(v)) {
        console.log(
          'MAXIMUM_LONG_LIVED_DURATION_DAYS not set, using default: ' +
            DEFAULT_MAXIMUM_LONG_LIVED_DURATION_DAYS
        );
        return DEFAULT_MAXIMUM_LONG_LIVED_DURATION_DAYS;
      }
      if (['unlimited', 'infinite', 'none'].includes(v.toLowerCase())) {
        console.log('Long-lived tokens configured for unlimited duration');
        return undefined;
      }
      const parsedDays = parseInt(v, 10);
      if (Number.isNaN(parsedDays) || parsedDays <= 0) {
        console.warn(
          `Invalid value "${v}" for MAXIMUM_LONG_LIVED_DURATION_DAYS. Must be a positive integer or "unlimited".`
        );
        console.log('Falling back to default configuration.');
        return DEFAULT_MAXIMUM_LONG_LIVED_DURATION_DAYS;
      }
      return parsedDays;
    }),
  bugsnagApiKey: z
    .string()
    .optional()
    .transform((v): string | undefined => {
      if (isBlank(v)) {
        console.log('BUGSNAG_API_KEY not set, error reporting disabled');
        return undefined;
      }
      return v;
    }),
});

const parsedConfig = ConfigSchema.parse({
  conductorPublicUrl: rawEnv.CONDUCTOR_PUBLIC_URL,
  webAppPublicUrl: rawEnv.WEB_APP_PUBLIC_URL,
  androidAppUrl: rawEnv.ANDROID_APP_PUBLIC_URL,
  iosAppUrl: rawEnv.IOS_APP_PUBLIC_URL,
  designerUrl: rawEnv.DESIGNER_URL,
  couchdbInternalUrl: rawEnv.COUCHDB_INTERNAL_URL,
  couchdbPublicUrl: rawEnv.COUCHDB_PUBLIC_URL,
  conductorKeyId: rawEnv.PROFILE_NAME,
  keyFilePath: rawEnv.KEY_FILE_PATH,
  shortCodePrefix: rawEnv.CONDUCTOR_SHORT_CODE_PREFIX,
  instanceDescription: rawEnv.CONDUCTOR_DESCRIPTION,
  cookieSecret: rawEnv.FAIMS_COOKIE_SECRET,
  conductorInternalPort: rawEnv.CONDUCTOR_INTERNAL_PORT,
  developerMode: rawEnv.DEVELOPER_MODE,
  provisionSSOUsersPolicy: rawEnv.PROVISION_SSO_USERS_POLICY,
  accessTokenExpiryMinutes: rawEnv.ACCESS_TOKEN_EXPIRY_MINUTES,
  refreshTokenExpiryMinutes: rawEnv.REFRESH_TOKEN_EXPIRY_MINUTES,
  emailCodeExpiryMinutes: rawEnv.EMAIL_CODE_EXPIRY_MINUTES,
  rateLimiterWindowMs: rawEnv.RATE_LIMITER_WINDOW_MS,
  rateLimiterPerWindow: rawEnv.RATE_LIMITER_PER_WINDOW,
  rateLimiterEnabled: rawEnv.RATE_LIMITER_ENABLED,
  migrateNotebooksOnStartup: rawEnv.MIGRATE_NOTEBOOKS_ON_STARTUP,
  keySource: rawEnv.KEY_SOURCE,
  maximumLongLivedDurationDays: rawEnv.MAXIMUM_LONG_LIVED_DURATION_DAYS,
  bugsnagApiKey: rawEnv.BUGSNAG_API_KEY,
});

// ---------------------------------------------------------------------------
// Values that depend on other config, are required, or need custom handling.
// ---------------------------------------------------------------------------

/** Local couchdb auth used by the server (as opposed to test COUCHDB_USER/PASSWORD). */
function buildLocalCouchdbAuth(): {username: string; password: string} {
  const username = rawEnv.COUCHDB_USER;
  const password = rawEnv.COUCHDB_PASSWORD;
  if (isBlank(username) || isBlank(password)) {
    console.warn('Falling back to default local couchdb auth');
    return {username: 'admin', password: 'password'};
  }
  return {username, password};
}

function buildInstanceName(): string {
  const name = rawEnv.CONDUCTOR_INSTANCE_NAME;
  if (isBlank(name)) {
    console.log(
      'CONDUCTOR_INSTANCE_NAME not set, using PROFILE_NAME for instance name'
    );
    return parsedConfig.conductorKeyId;
  }
  return name;
}

// Config variable is DISABLE_LOCAL_LOGIN for ease of use, but we expose
// LOCAL_LOGIN_ENABLED for clarity in the rest of the codebase.
function buildLocalLoginEnabled(): boolean {
  const disableLocalLogin = rawEnv.DISABLE_LOCAL_LOGIN;
  if (disableLocalLogin === undefined) {
    return true;
  }
  return disableLocalLogin.toLowerCase() !== 'true';
}

function buildRunningUnderTest(): boolean {
  const jestWorkerIsRunning = rawEnv.JEST_WORKER_ID !== undefined;
  const testNodeEnv = rawEnv.NODE_ENV === 'test';
  return jestWorkerIsRunning || testNodeEnv;
}

/**
 * What is the URL of the new conductor? Required. No trailing slash.
 */
function buildNewConductorUrl(): string {
  let conductorUrl = rawEnv.NEW_CONDUCTOR_URL;
  if (isBlank(conductorUrl)) {
    throw Error('You must provide a NEW_CONDUCTOR_URL in your environment.');
  }
  if (conductorUrl.endsWith('/')) {
    console.log('NEW_CONDUCTOR_URL should not end with / - removing it');
    conductorUrl = conductorUrl.substring(0, conductorUrl.length - 1);
  }
  return conductorUrl;
}

/**
 * Parses and validates the redirect whitelist. Comma-separated list of domains
 * to which redirects are allowed for auth flows.
 * @throws If the whitelist is not defined, contains invalid entries, or is empty.
 */
function buildRedirectWhitelist(): string[] {
  const whitelist = rawEnv.REDIRECT_WHITELIST;
  if (isBlank(whitelist)) {
    throw new Error(
      'REDIRECT_WHITELIST environment variable is required. Please provide a comma-separated list of allowed domains for redirects.'
    );
  }

  const domains = whitelist
    .split(',')
    .map(domain => domain.trim())
    .filter(domain => domain.length !== 0);

  if (domains.length === 0) {
    throw new Error(
      'REDIRECT_WHITELIST must contain at least one valid domain.'
    );
  }

  for (const domain of domains) {
    try {
      new URL(domain);
    } catch (err) {
      throw new Error(
        `Invalid domain in REDIRECT_WHITELIST: "${domain}". Each entry must be a valid URL.`
      );
    }
  }

  return domains;
}

function buildAwsSecretKeyArn(): string | undefined {
  if (parsedConfig.keySource !== KeySource.AWS_SM) {
    return undefined;
  }
  const arn = rawEnv.AWS_SECRET_KEY_ARN;
  if (!arn) {
    throw new Error('AWS_SECRET_KEY_ARN is not set but KEY_SOURCE is AWS_SM');
  }
  return arn;
}

/**
 * The singleton configuration object. Prefer reading values from here.
 *
 * Note: intentionally not frozen so that tests can override individual values
 * at runtime (e.g. provisioning policy) via `config.<field> = ...`.
 */
export const config = {
  ...parsedConfig,
  localCouchdbAuth: buildLocalCouchdbAuth(),
  conductorInstanceName: buildInstanceName(),
  localLoginEnabled: buildLocalLoginEnabled(),
  runningUnderTest: buildRunningUnderTest(),
  newConductorUrl: buildNewConductorUrl(),
  redirectWhitelist: buildRedirectWhitelist(),
  awsSecretKeyArn: buildAwsSecretKeyArn(),
};

export type Config = typeof config;

// A slugified id derived from the instance name.
export const CONDUCTOR_SERVER_ID = slugify(config.conductorInstanceName);

// ---------------------------------------------------------------------------
// Key file paths (kept as functions so callers resolve/validate them lazily).
// ---------------------------------------------------------------------------

// Generate public and private key file names in the same way as makeInstanceKeys.sh.
function keyFileHost(): string {
  const host = rawEnv.PROFILE_NAME;
  return isBlank(host) ? 'conductor' : host;
}

export function private_key_path(): string {
  const keyfile = `${config.keyFilePath}/keys/${keyFileHost()}_private_key.pem`;
  if (existsSync(keyfile)) {
    console.log(`Private key file ${keyfile} exists.`);
    return keyfile;
  }
  throw new Error(
    `Private key file ${keyfile} does not exist. Please run makeInstanceKeys.sh to generate keys.`
  );
}

export function public_key_path(): string {
  const keyfile = `${config.keyFilePath}/keys/${keyFileHost()}_public_key.pem`;
  if (existsSync(keyfile)) {
    console.log(`Public key file ${keyfile} exists.`);
    return keyfile;
  }
  throw new Error(
    `Public key file ${keyfile} does not exist. Please run makeInstanceKeys.sh to generate keys.`
  );
}

// Dependency injection pattern for key service.
export const KEY_SERVICE: IKeyService = getKeyService(config.keySource);

// ---------------------------------------------------------------------------
// Email service configuration and singleton.
// ---------------------------------------------------------------------------

/**
 * Determines which email service type to use based on environment variables.
 */
function getEmailServiceType(): EmailServiceType {
  if (config.runningUnderTest) {
    console.log('Since we are testing, using mock email service.');
    return EmailServiceType.MOCK;
  }

  const emailServiceType = rawEnv.EMAIL_SERVICE_TYPE as
    | EmailServiceType
    | undefined;
  if (
    emailServiceType === undefined ||
    !(emailServiceType in EmailServiceType)
  ) {
    console.log(
      'EMAIL_SERVICE_TYPE not set or invalid, using default SMTP - configuration may not be available depending on your environment. Please explicitly configure SMTP if this is the preferred behaviour.'
    );
    return EmailServiceType.SMTP;
  }

  return emailServiceType;
}

/**
 * Gets the email configuration from environment variables.
 */
function getEmailConfig(): EmailConfig {
  const fromEmail = rawEnv.EMAIL_FROM_ADDRESS;
  const fromName = rawEnv.EMAIL_FROM_NAME;
  const replyTo = rawEnv.EMAIL_REPLY_TO;

  if (!fromEmail || !fromName) {
    console.warn('Email configuration is incomplete. Using default values.');
    return {
      fromEmail: fromEmail || DEFAULT_FROM_EMAIL,
      fromName: fromName || DEFAULT_FROM_NAME,
      replyTo: replyTo,
    };
  }

  return {fromEmail, fromName, replyTo};
}

/**
 * Gets the SMTP configuration from environment variables.
 */
function getSMTPConfig(): SMTPEmailServiceConfig {
  const host = rawEnv.SMTP_HOST;
  const portStr = rawEnv.SMTP_PORT;
  const secure = rawEnv.SMTP_SECURE === 'true';
  const user = rawEnv.SMTP_USER;
  const pass = rawEnv.SMTP_PASSWORD;
  const cacheExpirySecondsStr = rawEnv.SMTP_CACHE_EXPIRY_SECONDS;

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
    auth: {user: user!, pass: pass!},
    cacheExpirySeconds,
  };
}

export const EMAIL_SERVICE_TYPE = getEmailServiceType();
export const EMAIL_CONFIG = getEmailConfig();
export const EMAIL_SERVICE_CONFIG =
  EMAIL_SERVICE_TYPE === EmailServiceType.SMTP ? getSMTPConfig() : undefined;
export const EMAIL_SERVICE: IEmailService = createEmailService({
  serviceType: EMAIL_SERVICE_TYPE,
  emailConfig: EMAIL_CONFIG,
  serviceConfig:
    EMAIL_SERVICE_TYPE === EmailServiceType.SMTP
      ? EMAIL_SERVICE_CONFIG
      : undefined,
});

/**
 * Gets the test email address configuration from environment variables.
 * @throws Error if the test email address is not configured (outside of tests).
 */
function getTestEmailAddress(): string {
  // Uses a fake address if we are unit testing.
  if (config.runningUnderTest) {
    return 'fake@gmail.com';
  }

  const testEmailAddress = rawEnv.TEST_EMAIL_ADDRESS;
  if (!testEmailAddress) {
    throw new Error(
      'TEST_EMAIL_ADDRESS environment variable is required for testing email functionality. ' +
        'Please add this to your environment configuration.'
    );
  }

  return testEmailAddress;
}

export const TEST_EMAIL_ADDRESS = getTestEmailAddress();
