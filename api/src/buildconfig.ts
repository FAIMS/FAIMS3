// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: buildconfig.ts
 * Description:
 *   This module exports the configuration of the build, including things like
 *   which server to use and whether to include test data.
 *   The shared, env-backed scalars are parsed from `process.env` via the
 *   @faims3/build-config module (`parseGeneratedEnv`), the single source of
 *   truth for the config chain. This module then layers on the server-specific
 *   runtime values that are deliberately not shared (see ADR-0001 D4):
 *     - signing-key identity: conductorKeyId / keyFileHost / conductorInstanceName
 *       (all fall back from PROFILE_NAME) and conductorServerId (slugified)
 *     - key-file path existence check, cookie-secret generation when unset
 *     - local CouchDB auth (both-or-default) and the inverted local-login flag
 *     - runningUnderTest (JEST_WORKER_ID / NODE_ENV) and its overrides (mock
 *       email, forced-off export limiter, fake test email)
 *     - the AWS Secrets Manager ARN check and the full SMTP/email resolution
 *       (the server's from-address defaults and SMTP fail-fast are its own)
 *     - the redirect whitelist (required, each entry must be a valid URL)
 *   Prefer importing `{config}` and reading `config.<field>`. Service singletons
 *   (`keyService`, `emailService`) and lazy key-file path helpers remain as
 *   dedicated exports for DI / test replacement.
 */

import {parseGeneratedEnv} from '@faims3/build-config';
import {
  configHelpers,
  RECORDS_HYDRATED_PAGE_LIMIT_MAX,
  slugify,
} from '@faims3/data-model';
import {existsSync} from 'fs';
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
import type {ProvisionSSOUsersPolicy} from './auth/types';

console.log(`Using API version from package.json: ${packageVersion}`);

// Server-only email defaults (distinct from the shared model's).
const DEFAULT_FROM_EMAIL = 'noreply@example.com';
const DEFAULT_FROM_NAME = 'FAIMS System Notification';

// Export mint/redeem limiter defaults (kept as named exports for tests); they
// match the shared model's defaults.
export const DEFAULT_EXPORT_RATE_LIMITER_WINDOW_MS = 10 * 60 * 1000;
export const DEFAULT_EXPORT_RATE_LIMITER_PER_WINDOW = 20;

const stripTrailingSlash = (value: string): string =>
  value.endsWith('/') ? value.substring(0, value.length - 1) : value;

// ---------------------------------------------------------------------------
// Canonical env-backed config, parsed from process.env by the shared module.
// ---------------------------------------------------------------------------

const canonical = parseGeneratedEnv(process.env);

// ---------------------------------------------------------------------------
// Server-specific runtime derivations (ADR-0001 D4 — intentionally local).
// ---------------------------------------------------------------------------

/** Present under Jest / when NODE_ENV=test. */
const runningUnderTest =
  process.env.JEST_WORKER_ID !== undefined || process.env.NODE_ENV === 'test';

// Signing-key identity. Blank PROFILE_NAME → 'test' key id / 'conductor' key
// file host (distinct on purpose); the instance name falls back to the key id.
const profileName = process.env.PROFILE_NAME;
const conductorKeyId = configHelpers.isBlank(profileName)
  ? 'test'
  : profileName!;
const keyFileHost = configHelpers.isBlank(profileName)
  ? 'conductor'
  : profileName!;
const conductorInstanceName = configHelpers.isBlank(
  process.env.CONDUCTOR_INSTANCE_NAME
)
  ? conductorKeyId
  : process.env.CONDUCTOR_INSTANCE_NAME!;

// Key-file path: fall back to '.' when the configured path does not exist.
const keyFilePath = existsSync(canonical.auth.keyFilePath)
  ? canonical.auth.keyFilePath
  : '.';

// Cookie secret: generated when unset so sessions do not silently share a
// blank signing secret.
const cookieSecret = canonical.auth.cookieSecret
  ? canonical.auth.cookieSecret
  : crypto.randomUUID();

// Local CouchDB auth: only used as a pair; a partial pair falls back to the
// local dev credentials.
const localCouchdbAuth: {username: string; password: string} =
  configHelpers.isBlank(process.env.COUCHDB_USER) ||
  configHelpers.isBlank(process.env.COUCHDB_PASSWORD)
    ? {username: 'admin', password: 'password'}
    : {
        username: process.env.COUCHDB_USER!,
        password: process.env.COUCHDB_PASSWORD!,
      };

// Local login is enabled unless explicitly disabled.
const localLoginEnabled = !canonical.auth.disableLocalLogin;

// AWS Secrets Manager ARN, only required when KEY_SOURCE is AWS_SM.
let awsSecretKeyArn: string | undefined;
if (canonical.auth.keySource === 'AWS_SM') {
  if (!canonical.auth.awsSecretKeyArn) {
    throw new Error(
      'AWS_SECRET_KEY_ARN is not set but KEY_SOURCE is AWS_SM'
    );
  }
  awsSecretKeyArn = canonical.auth.awsSecretKeyArn;
}

// Redirect whitelist: required, and every entry must be a valid URL.
const redirectWhitelist: string[] = (process.env.REDIRECT_WHITELIST ?? '')
  .split(',')
  .map(domain => domain.trim())
  .filter(domain => domain.length > 0);
if (redirectWhitelist.length === 0) {
  throw new Error(
    'REDIRECT_WHITELIST environment variable is required. Please provide a comma-separated list of allowed domains for redirects.'
  );
}
for (const domain of redirectWhitelist) {
  try {
    new URL(domain);
  } catch {
    throw new Error(
      `Invalid domain in REDIRECT_WHITELIST: "${domain}". Each entry must be a valid URL.`
    );
  }
}

// Export limiter defaults off under test (shared in-memory store).
const exportRateLimiterEnabled = runningUnderTest
  ? false
  : canonical.limits.exportRateLimiterEnabled;

// Cap the hydrated-records page limit at the shared maximum.
const recordsHydratedPageLimit = Math.min(
  canonical.limits.recordsHydratedPageLimit,
  RECORDS_HYDRATED_PAGE_LIMIT_MAX
);

// The shared model uses the 'unlimited' sentinel for no cap; the server's
// config uses `undefined` to mean "no maximum".
const maximumLongLivedDurationDays: number | undefined =
  canonical.authTokens.maximumLongLivedDurationDays === 'unlimited'
    ? undefined
    : canonical.authTokens.maximumLongLivedDurationDays;

// ---------------------------------------------------------------------------
// Email: the server's own resolution (defaults + SMTP fail-fast) on raw env.
// ---------------------------------------------------------------------------

function resolveEmailServiceType(): EmailServiceType {
  if (runningUnderTest) {
    console.log('Since we are testing, using mock email service.');
    return EmailServiceType.MOCK;
  }
  const raw = process.env.EMAIL_SERVICE_TYPE;
  if (raw === undefined) return EmailServiceType.SMTP;
  if (raw === 'SMTP' || raw === 'MOCK') return raw as EmailServiceType;
  throw new Error(`Invalid EMAIL_SERVICE_TYPE: "${raw}". Expected SMTP or MOCK.`);
}

/** Builds from/name/reply-to from email env, with defaults when incomplete. */
function resolveEmailConfig(): EmailConfig {
  const fromEmail = process.env.EMAIL_FROM_ADDRESS;
  const fromName = process.env.EMAIL_FROM_NAME;
  const replyTo = process.env.EMAIL_REPLY_TO;

  if (!fromEmail || !fromName) {
    console.warn('Email configuration is incomplete. Using default values.');
    return {
      fromEmail: fromEmail || DEFAULT_FROM_EMAIL,
      fromName: fromName || DEFAULT_FROM_NAME,
      replyTo,
    };
  }

  return {fromEmail, fromName, replyTo};
}

/** Validates SMTP env and throws with a detailed missing-field report if incomplete. */
function resolveSmtpConfig(): SMTPEmailServiceConfig {
  const host = process.env.SMTP_HOST;
  const portStr = process.env.SMTP_PORT;
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const cacheExpirySecondsStr = process.env.SMTP_CACHE_EXPIRY_SECONDS;

  // Check for missing configuration and provide a detailed error message
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

  return {
    host: host!,
    port: parseInt(portStr!),
    secure,
    auth: {user: user!, pass: pass!},
    cacheExpirySeconds: cacheExpirySecondsStr
      ? parseInt(cacheExpirySecondsStr)
      : 300,
  };
}

const emailServiceType = resolveEmailServiceType();
const email = resolveEmailConfig();
const testEmailAddress = runningUnderTest
  ? 'fake@gmail.com'
  : configHelpers.isBlank(process.env.TEST_EMAIL_ADDRESS)
    ? undefined
    : process.env.TEST_EMAIL_ADDRESS;

/**
 * The singleton configuration object. Prefer reading values from here.
 *
 * Note: intentionally not frozen so that tests can override individual values
 * at runtime (e.g. provisioning policy) via `config.<field> = ...`.
 */
export const config = {
  // Env-backed endpoints (from the shared canonical config).
  conductorPublicUrl: stripTrailingSlash(canonical.endpoints.apiUrl),
  webAppPublicUrl: canonical.endpoints.appUrl,
  androidAppUrl: canonical.endpoints.androidAppPublicUrl,
  iosAppUrl: canonical.endpoints.iosAppPublicUrl,
  couchdbInternalUrl: canonical.endpoints.couchdbInternalUrl,
  couchdbPublicUrl: canonical.endpoints.couchdbPublicUrl,
  conductorInternalPort: canonical.couchdb.conductorInternalPort,

  // Branding (server-facing).
  instanceDescription: canonical.branding.conductorDescription,
  shortCodePrefix: canonical.branding.conductorShortCodePrefix,

  // Auth.
  keySource: canonical.auth.keySource as KeySource,
  awsSecretKeyArn,
  provisionSSOUsersPolicy:
    canonical.auth.provisionSsoUsersPolicy as ProvisionSSOUsersPolicy,
  localLoginEnabled,
  cookieSecret,

  // Token lifetimes.
  accessTokenExpiryMinutes: canonical.authTokens.accessTokenExpiryMinutes,
  refreshTokenExpiryMinutes: canonical.authTokens.refreshTokenExpiryMinutes,
  impersonationSessionExpiryMinutes:
    canonical.authTokens.impersonationSessionExpiryMinutes,
  emailCodeExpiryMinutes: canonical.authTokens.emailCodeExpiryMinutes,
  maximumLongLivedDurationDays,

  // Migrations.
  disableMigrateOnStartup: canonical.migration.disableMigrateOnStartup,
  startupMigrationLockEnabled: canonical.migration.startupMigrationLockEnabled,
  startupMigrationLockTimeoutMs:
    canonical.migration.startupMigrationLockTimeoutMs,

  // Rate / attempt limiters.
  rateLimiterWindowMs: canonical.limits.rateLimiterWindowMs,
  rateLimiterPerWindow: canonical.limits.rateLimiterPerWindow,
  rateLimiterEnabled: canonical.limits.rateLimiterEnabled,
  exportRateLimiterEnabled,
  exportRateLimiterWindowMs: canonical.limits.exportRateLimiterWindowMs,
  exportRateLimiterPerWindow: canonical.limits.exportRateLimiterPerWindow,
  authAttemptLimiterEnabled: canonical.limits.attemptLimiterEnabled,

  // Request body / upload size limits.
  jsonBodyLimit: canonical.limits.jsonBodyLimit,
  urlencodedBodyLimit: canonical.limits.urlencodedBodyLimit,
  restoreUploadMaxBytes: canonical.limits.restoreUploadMaxBytes,
  recordsHydratedPageLimit,
  downloadCookieSameSite: canonical.limits.downloadCookieSameSite,

  // Developer mode + observability.
  developerMode: canonical.dev.developerMode,
  bugsnagApiKey: canonical.observability.bugsnagApiKey,

  // Server-specific identity / auth / runtime values.
  conductorKeyId,
  conductorInstanceName,
  conductorServerId: slugify(conductorInstanceName),
  keyFilePath,
  localCouchdbAuth,
  runningUnderTest,
  redirectWhitelist,

  // Build-time.
  apiVersion: packageVersion,

  // Email.
  emailServiceType,
  email,
  /** Present for the admin email-test endpoint; optional at startup. */
  testEmailAddress,
};

export type Config = typeof config;

// ---------------------------------------------------------------------------
// Key file paths (lazy). Filenames match makeInstanceKeys.sh:
//   keys/<host>_{private,public}_key.pem
// ---------------------------------------------------------------------------

/** Absolute path to the PEM private key used for JWT signing. */
export function privateKeyPath(): string {
  const keyfile = `${config.keyFilePath}/keys/${keyFileHost}_private_key.pem`;
  if (existsSync(keyfile)) {
    console.log(`Private key file ${keyfile} exists.`);
    return keyfile;
  }
  throw new Error(
    `Private key file ${keyfile} does not exist. Please run makeInstanceKeys.sh to generate keys.`
  );
}

/** Absolute path to the PEM public key paired with `privateKeyPath()`. */
export function publicKeyPath(): string {
  const keyfile = `${config.keyFilePath}/keys/${keyFileHost}_public_key.pem`;
  if (existsSync(keyfile)) {
    console.log(`Public key file ${keyfile} exists.`);
    return keyfile;
  }
  throw new Error(
    `Public key file ${keyfile} does not exist. Please run makeInstanceKeys.sh to generate keys.`
  );
}

/**
 * Fail-fast local checks before the health listener binds. No Couch.
 * FILE keys are also validated when {@link keyService} is constructed.
 */
export function assertLocalStartupConfig(): void {
  if (config.keySource === KeySource.FILE) {
    privateKeyPath();
    publicKeyPath();
    return;
  }
  if (config.keySource === KeySource.ENV) {
    const privateKey = process.env.PRIVATE_SIGNING_KEY?.trim();
    const publicKey = process.env.PUBLIC_SIGNING_KEY?.trim();
    if (!privateKey || !publicKey) {
      throw new Error(
        'PRIVATE_SIGNING_KEY or PUBLIC_SIGNING_KEY environment variable not set but KEY_SOURCE is ENV'
      );
    }
  }
}

/** Signing-key singleton. */
export const keyService: IKeyService = getKeyService(config.keySource);

/** Email singleton. Tests may stub methods on this instance. */
export const emailService: IEmailService = createEmailService({
  serviceType: emailServiceType,
  emailConfig: email,
  serviceConfig:
    emailServiceType === EmailServiceType.SMTP
      ? resolveSmtpConfig()
      : undefined,
});
