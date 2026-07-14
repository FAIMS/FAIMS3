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
 *   Configuration is parsed from `process.env` with a single zod schema:
 *     - Each env key is declared once with its coercion / defaulting logic and
 *       is the place to document that setting.
 *     - `.strip()` drops unrelated process.env keys.
 *     - A final `.transform()` renames ENV_KEYS into the camelCase `config` shape
 *       (and builds a few cross-field / required values). Do not re-document
 *       env-backed fields in the transform.
 *
 *   Prefer importing `{config}` and reading `config.<field>`. Service singletons
 *   (`keyService`, `emailService`) and lazy key-file path helpers remain as
 *   dedicated exports for DI / test replacement.
 */

import {configHelpers, slugify} from '@faims3/data-model';
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
import {ProvisionSSOUsersPolicy} from './auth/types';

console.log(`Using API version from package.json: ${packageVersion}`);

// If a URL for the conductor instance is not provided this will be used as a fall-through
const DEFAULT_CONDUCTOR_URL = 'http://localhost:8080';
const DEFAULT_COUCHDB_URL = 'http://localhost:5984';
const DEFAULT_WEBAPP_URL = 'http://localhost:3000';

// 5 minute access token expiry by default
const DEFAULT_ACCESS_TOKEN_EXPIRY_MINUTES = 5;
// 2 days refresh token expiry by default
const DEFAULT_REFRESH_TOKEN_EXPIRY_MINUTES = 60 * 24 * 2;
// 60 minute default expiry for impersonation sessions. Impersonation sessions
// are kept short so that an admin's "log in as" session cannot linger.
const DEFAULT_IMPERSONATION_SESSION_EXPIRY_MINUTES = 60;
// 30 minute default expiry for email verification codes
const DEFAULT_EMAIL_CODE_EXPIRY_MINUTES = 30;
// 10 minutes / 1000 requests per window
const DEFAULT_RATE_LIMITER_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_RATE_LIMITER_PER_WINDOW = 1000;
// Long-lived token configuration
const DEFAULT_MAXIMUM_LONG_LIVED_DURATION_DAYS = 90;
// Request body / upload size limits (protect against oversized payloads)
/** Default cap for JSON bodies (covers notebook/template design uploads). */
const DEFAULT_JSON_BODY_LIMIT = '25mb';
/** Default cap for urlencoded (HTML form) bodies — auth forms are tiny. */
const DEFAULT_URLENCODED_BODY_LIMIT = '1mb';
/** Default cap for the developer-mode restore-from-backup upload (bytes). */
const DEFAULT_RESTORE_UPLOAD_MAX_BYTES = 1024 * 1024 * 1024; // 1 GiB

const DEFAULT_FROM_EMAIL = 'noreply@example.com';
const DEFAULT_FROM_NAME = 'FAIMS System Notification';

// ---------------------------------------------------------------------------
// Single-pass env schema: validate/coerce, strip unknowns, rename to config.
// ---------------------------------------------------------------------------

const EnvSchema = z
  .object({
    /** Public base URL of this Conductor server. */
    CONDUCTOR_PUBLIC_URL: configHelpers.stringDefault(
      DEFAULT_CONDUCTOR_URL,
      'CONDUCTOR_PUBLIC_URL'
    ),
    /** Public URL of the Fieldmark web/data-collection app. */
    WEB_APP_PUBLIC_URL: configHelpers.stringDefault(DEFAULT_WEBAPP_URL),
    /** Public URL / store link for the Android app build (optional). */
    ANDROID_APP_PUBLIC_URL: configHelpers.stringDefault(''),
    /** Public URL / store link for the iOS app build (optional). */
    IOS_APP_PUBLIC_URL: configHelpers.stringDefault(''),
    /** Public URL of the designer / Control Centre when separate from WEB_APP. */
    DESIGNER_URL: configHelpers.stringDefault(''),
    /** Internal (cluster/localhost) CouchDB URL used by the API process. */
    COUCHDB_INTERNAL_URL: configHelpers.urlNoTrailingSlash(
      DEFAULT_COUCHDB_URL,
      'COUCHDB_INTERNAL_URL'
    ),
    /** Public CouchDB URL advertised to clients. */
    COUCHDB_PUBLIC_URL: configHelpers.urlNoTrailingSlash(
      DEFAULT_COUCHDB_URL,
      'COUCHDB_PUBLIC_URL'
    ),
    /**
     * CouchDB admin username used by the server (paired with COUCHDB_PASSWORD).
     * Distinct from client-facing directory credentials.
     */
    COUCHDB_USER: z.string().optional(),
    /** CouchDB admin password paired with COUCHDB_USER. */
    COUCHDB_PASSWORD: z.string().optional(),
    /**
     * Deployment / signing profile name.
     * Kept raw: `conductorKeyId` defaults blank → `'test'`; key-file host →
     * `'conductor'`.
     */
    PROFILE_NAME: z.string().optional(),
    /**
     * Directory that contains `keys/<host>_{private,public}_key.pem`, matching
     * the layout produced by `makeInstanceKeys.sh`.
     */
    KEY_FILE_PATH: z
      .string()
      .optional()
      .transform(v => {
        if (configHelpers.isBlank(v)) {
          console.log('KEY_FILE_PATH not set, using default');
          return '.';
        }
        if (existsSync(v)) return v;
        console.log('KEY_FILE_PATH does not exist, using default');
        return '.';
      }),
    /** Human-readable instance name (falls back to PROFILE_NAME / key id). */
    CONDUCTOR_INSTANCE_NAME: z.string().optional(),
    /** Short-code prefix used when generating invite / project codes. */
    CONDUCTOR_SHORT_CODE_PREFIX: configHelpers.stringDefault(
      'FAIMS',
      'CONDUCTOR_SHORT_CODE_PREFIX'
    ),
    /** Free-text description of this Conductor instance. */
    CONDUCTOR_DESCRIPTION: configHelpers.stringDefault(
      'Fieldmark Conductor Server'
    ),
    /** Secret used to sign session cookies; generated if unset. */
    FAIMS_COOKIE_SECRET: z
      .string()
      .optional()
      .transform(v => {
        if (configHelpers.isBlank(v)) {
          console.log('FAIMS_COOKIE_SECRET not set, using generated secret');
          return crypto.randomUUID();
        }
        return v;
      }),
    /** Internal HTTP listen port for the Conductor process. */
    CONDUCTOR_INTERNAL_PORT: configHelpers.intDefault(8000),
    /** Enables developer-only routes and relaxed behaviours. */
    DEVELOPER_MODE: configHelpers.truthyBool(false),
    /**
     * How unknown SSO users are handled: `'own-team'`, `'general-user'`, or
     * `'reject'` (default — rejects unknown users via SSO).
     */
    PROVISION_SSO_USERS_POLICY: configHelpers.enumDefault(
      [
        'own-team',
        'general-user',
        'reject',
      ] as const satisfies readonly ProvisionSSOUsersPolicy[],
      'reject'
    ),
    /** Access-token lifetime in minutes. */
    ACCESS_TOKEN_EXPIRY_MINUTES: configHelpers.intDefault(
      DEFAULT_ACCESS_TOKEN_EXPIRY_MINUTES,
      'ACCESS_TOKEN_EXPIRY_MINUTES'
    ),
    /** Refresh-token lifetime in minutes. */
    REFRESH_TOKEN_EXPIRY_MINUTES: configHelpers.intDefault(
      DEFAULT_REFRESH_TOKEN_EXPIRY_MINUTES,
      'REFRESH_TOKEN_EXPIRY_MINUTES'
    ),
    /**
     * Lifetime (in minutes) of the refresh token issued for an impersonation
     * session.
     */
    IMPERSONATION_SESSION_EXPIRY_MINUTES: configHelpers.intDefault(
      DEFAULT_IMPERSONATION_SESSION_EXPIRY_MINUTES,
      'IMPERSONATION_SESSION_EXPIRY_MINUTES'
    ),
    /** Expiry time in minutes for email verification codes. */
    EMAIL_CODE_EXPIRY_MINUTES: configHelpers.intDefault(
      DEFAULT_EMAIL_CODE_EXPIRY_MINUTES,
      'EMAIL_CODE_EXPIRY_MINUTES'
    ),
    /** Rate-limiter window duration in milliseconds. */
    RATE_LIMITER_WINDOW_MS: configHelpers.intDefault(
      DEFAULT_RATE_LIMITER_WINDOW_MS,
      'RATE_LIMITER_WINDOW_MS'
    ),
    /** Number of requests allowed per rate-limiter window. */
    RATE_LIMITER_PER_WINDOW: configHelpers.intDefault(
      DEFAULT_RATE_LIMITER_PER_WINDOW,
      'RATE_LIMITER_PER_WINDOW'
    ),
    /** Whether HTTP rate limiting is enabled (`true` / other). */
    RATE_LIMITER_ENABLED: configHelpers.equalsTrueBool(true),
    /**
     * Canonical public URL of this Conductor (required). Trailing `/` is
     * stripped.
     */
    NEW_CONDUCTOR_URL: z
      .string({
        error: 'You must provide a NEW_CONDUCTOR_URL in your environment.',
      })
      .min(1, 'You must provide a NEW_CONDUCTOR_URL in your environment.')
      .transform(v => {
        if (v.endsWith('/')) {
          console.log('NEW_CONDUCTOR_URL should not end with / - removing it');
          return v.substring(0, v.length - 1);
        }
        return v;
      }),
    /**
     * Env flag to disable local username/password login. Coerced here to the
     * inverted `localLoginEnabled` boolean (unset → enabled).
     */
    DISABLE_LOCAL_LOGIN: z
      .string()
      .optional()
      .transform(v => (v === undefined ? true : v.toLowerCase() !== 'true')),
    /** Configure migration of notebooks on startup. */
    MIGRATE_NOTEBOOKS_ON_STARTUP: configHelpers.equalsTrueBool(true),
    /** Where signing keys are loaded from (`FILE` or `AWS_SM`). */
    KEY_SOURCE: configHelpers.nativeEnumDefault(KeySource, KeySource.FILE),
    /** AWS Secrets Manager ARN for signing keys; required when KEY_SOURCE is AWS_SM. */
    AWS_SECRET_KEY_ARN: z.string().optional(),
    /** Email backend: SMTP in production; forced to MOCK under test. */
    EMAIL_SERVICE_TYPE: configHelpers.nativeEnumDefault(
      EmailServiceType,
      EmailServiceType.SMTP
    ),
    /** From-address for outbound system email. */
    EMAIL_FROM_ADDRESS: z.string().optional(),
    /** From-name for outbound system email. */
    EMAIL_FROM_NAME: z.string().optional(),
    /** Optional Reply-To address for outbound email. */
    EMAIL_REPLY_TO: z.string().optional(),
    /** SMTP host (required when EMAIL_SERVICE_TYPE is SMTP). */
    SMTP_HOST: z.string().optional(),
    /** SMTP port (required when EMAIL_SERVICE_TYPE is SMTP). */
    SMTP_PORT: z.string().optional(),
    /** Whether SMTP uses TLS (`'true'` / other). */
    SMTP_SECURE: z.string().optional(),
    /** SMTP username (required when EMAIL_SERVICE_TYPE is SMTP). */
    SMTP_USER: z.string().optional(),
    /** SMTP password (required when EMAIL_SERVICE_TYPE is SMTP). */
    SMTP_PASSWORD: z.string().optional(),
    /** Optional SMTP connection-cache expiry in seconds (default 300). */
    SMTP_CACHE_EXPIRY_SECONDS: z.string().optional(),
    /**
     * Destination for the admin email-test endpoint. Optional at startup;
     * validated when the endpoint is used. Forced to a fake address under test.
     */
    TEST_EMAIL_ADDRESS: z.string().optional(),
    /**
     * Comma-separated list of domains to which auth-flow redirects are
     * allowed. Required; each entry must be a valid URL.
     */
    REDIRECT_WHITELIST: z
      .string({
        error:
          'REDIRECT_WHITELIST environment variable is required. Please provide a comma-separated list of allowed domains for redirects.',
      })
      .min(
        1,
        'REDIRECT_WHITELIST environment variable is required. Please provide a comma-separated list of allowed domains for redirects.'
      )
      .transform((v, ctx) => {
        const domains = v
          .split(',')
          .map(domain => domain.trim())
          .filter(domain => domain.length !== 0);
        if (domains.length === 0) {
          ctx.addIssue({
            code: 'custom',
            message:
              'REDIRECT_WHITELIST must contain at least one valid domain.',
          });
          return z.NEVER;
        }
        for (const domain of domains) {
          try {
            new URL(domain);
          } catch {
            ctx.addIssue({
              code: 'custom',
              message: `Invalid domain in REDIRECT_WHITELIST: "${domain}". Each entry must be a valid URL.`,
            });
            return z.NEVER;
          }
        }
        return domains;
      }),
    /**
     * Maximum duration in days for long-lived tokens. Use `"unlimited"` /
     * `"infinite"` / `"none"` for no cap; blank falls back to the default.
     */
    MAXIMUM_LONG_LIVED_DURATION_DAYS: z
      .string()
      .optional()
      .transform((v): number | undefined => {
        if (configHelpers.isBlank(v)) {
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
    /** Bugsnag API key; unset disables error reporting. */
    BUGSNAG_API_KEY: z
      .string()
      .optional()
      .transform((v): string | undefined => {
        if (configHelpers.isBlank(v)) {
          console.log('BUGSNAG_API_KEY not set, error reporting disabled');
          return undefined;
        }
        return v;
      }),
    /**
     * JSON body size limit for body-parser (e.g. `'25mb'`, `'500kb'`).
     * Bounds notebook/template design uploads among other JSON payloads.
     */
    JSON_BODY_LIMIT: configHelpers.stringDefault(DEFAULT_JSON_BODY_LIMIT),
    /**
     * Urlencoded (HTML form) body size limit for body-parser
     * (e.g. `'1mb'`, `'100kb'`). Auth forms are tiny.
     */
    URLENCODED_BODY_LIMIT: configHelpers.stringDefault(
      DEFAULT_URLENCODED_BODY_LIMIT
    ),
    /**
     * Maximum file size (bytes) accepted by the developer-mode
     * POST /api/restore upload.
     */
    RESTORE_UPLOAD_MAX_BYTES: z
      .string()
      .optional()
      .transform((v): number => {
        if (configHelpers.isBlank(v)) {
          return DEFAULT_RESTORE_UPLOAD_MAX_BYTES;
        }
        const parsed = parseInt(v, 10);
        if (Number.isNaN(parsed) || parsed <= 0) {
          console.warn(
            `Invalid value "${v}" for RESTORE_UPLOAD_MAX_BYTES. Must be a positive integer (bytes). Falling back to default.`
          );
          return DEFAULT_RESTORE_UPLOAD_MAX_BYTES;
        }
        return parsed;
      }),
    /** Present when running under Jest; contributes to `runningUnderTest`. */
    JEST_WORKER_ID: z.string().optional(),
    /** Node environment; `'test'` contributes to `runningUnderTest`. */
    NODE_ENV: z.string().optional(),
  })
  .strip()
  .transform(env => {
    // AWS ARN only required when KEY_SOURCE is AWS_SM
    let awsSecretKeyArn: string | undefined;
    if (env.KEY_SOURCE === KeySource.AWS_SM) {
      if (!env.AWS_SECRET_KEY_ARN) {
        throw new Error(
          'AWS_SECRET_KEY_ARN is not set but KEY_SOURCE is AWS_SM'
        );
      }
      awsSecretKeyArn = env.AWS_SECRET_KEY_ARN;
    }

    let conductorKeyId: string;
    if (configHelpers.isBlank(env.PROFILE_NAME)) {
      console.log('PROFILE_NAME not set, using default for signing key');
      conductorKeyId = 'test';
    } else {
      conductorKeyId = env.PROFILE_NAME;
    }

    let conductorInstanceName: string;
    if (configHelpers.isBlank(env.CONDUCTOR_INSTANCE_NAME)) {
      console.log(
        'CONDUCTOR_INSTANCE_NAME not set, using PROFILE_NAME for instance name'
      );
      conductorInstanceName = conductorKeyId;
    } else {
      conductorInstanceName = env.CONDUCTOR_INSTANCE_NAME;
    }

    let localCouchdbAuth: {username: string; password: string};
    if (
      configHelpers.isBlank(env.COUCHDB_USER) ||
      configHelpers.isBlank(env.COUCHDB_PASSWORD)
    ) {
      console.warn('Falling back to default local couchdb auth');
      localCouchdbAuth = {username: 'admin', password: 'password'};
    } else {
      localCouchdbAuth = {
        username: env.COUCHDB_USER,
        password: env.COUCHDB_PASSWORD,
      };
    }

    const runningUnderTest =
      env.JEST_WORKER_ID !== undefined || env.NODE_ENV === 'test';

    // Key-file host: blank PROFILE_NAME -> 'conductor' (distinct from key id).
    const keyFileHost = configHelpers.isBlank(env.PROFILE_NAME)
      ? 'conductor'
      : env.PROFILE_NAME;

    return {
      conductorPublicUrl: env.CONDUCTOR_PUBLIC_URL,
      webAppPublicUrl: env.WEB_APP_PUBLIC_URL,
      androidAppUrl: env.ANDROID_APP_PUBLIC_URL,
      iosAppUrl: env.IOS_APP_PUBLIC_URL,
      designerUrl: env.DESIGNER_URL,
      couchdbInternalUrl: env.COUCHDB_INTERNAL_URL,
      couchdbPublicUrl: env.COUCHDB_PUBLIC_URL,
      conductorKeyId,
      keyFilePath: env.KEY_FILE_PATH,
      shortCodePrefix: env.CONDUCTOR_SHORT_CODE_PREFIX,
      instanceDescription: env.CONDUCTOR_DESCRIPTION,
      cookieSecret: env.FAIMS_COOKIE_SECRET,
      conductorInternalPort: env.CONDUCTOR_INTERNAL_PORT,
      developerMode: env.DEVELOPER_MODE,
      provisionSSOUsersPolicy: env.PROVISION_SSO_USERS_POLICY,
      accessTokenExpiryMinutes: env.ACCESS_TOKEN_EXPIRY_MINUTES,
      refreshTokenExpiryMinutes: env.REFRESH_TOKEN_EXPIRY_MINUTES,
      impersonationSessionExpiryMinutes:
        env.IMPERSONATION_SESSION_EXPIRY_MINUTES,
      emailCodeExpiryMinutes: env.EMAIL_CODE_EXPIRY_MINUTES,
      rateLimiterWindowMs: env.RATE_LIMITER_WINDOW_MS,
      rateLimiterPerWindow: env.RATE_LIMITER_PER_WINDOW,
      rateLimiterEnabled: env.RATE_LIMITER_ENABLED,
      migrateNotebooksOnStartup: env.MIGRATE_NOTEBOOKS_ON_STARTUP,
      keySource: env.KEY_SOURCE,
      maximumLongLivedDurationDays: env.MAXIMUM_LONG_LIVED_DURATION_DAYS,
      bugsnagApiKey: env.BUGSNAG_API_KEY,
      jsonBodyLimit: env.JSON_BODY_LIMIT,
      urlencodedBodyLimit: env.URLENCODED_BODY_LIMIT,
      restoreUploadMaxBytes: env.RESTORE_UPLOAD_MAX_BYTES,
      localCouchdbAuth,
      conductorInstanceName,
      localLoginEnabled: env.DISABLE_LOCAL_LOGIN,
      runningUnderTest,
      newConductorUrl: env.NEW_CONDUCTOR_URL,
      redirectWhitelist: env.REDIRECT_WHITELIST,
      awsSecretKeyArn,
      // Internal: peeled off before exporting `config`.
      _email: {
        serviceType: env.EMAIL_SERVICE_TYPE,
        fromAddress: env.EMAIL_FROM_ADDRESS,
        fromName: env.EMAIL_FROM_NAME,
        replyTo: env.EMAIL_REPLY_TO,
        smtpHost: env.SMTP_HOST,
        smtpPort: env.SMTP_PORT,
        smtpSecure: env.SMTP_SECURE,
        smtpUser: env.SMTP_USER,
        smtpPassword: env.SMTP_PASSWORD,
        smtpCacheExpirySeconds: env.SMTP_CACHE_EXPIRY_SECONDS,
        testEmailAddress: env.TEST_EMAIL_ADDRESS,
      },
      _keyFileHost: keyFileHost,
    };
  });

const parsed = EnvSchema.parse(process.env);

const {_email, _keyFileHost, ...configFields} = parsed;

// ---------------------------------------------------------------------------
// Email scalars resolved once and hung on `config`.
// ---------------------------------------------------------------------------

function resolveEmailServiceType(): EmailServiceType {
  if (configFields.runningUnderTest) {
    console.log('Since we are testing, using mock email service.');
    return EmailServiceType.MOCK;
  }
  return _email.serviceType;
}

/** Builds from/name/reply-to from email env, with defaults when incomplete. */
function resolveEmailConfig(): EmailConfig {
  const fromEmail = _email.fromAddress;
  const fromName = _email.fromName;
  const replyTo = _email.replyTo;

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
  const host = _email.smtpHost;
  const portStr = _email.smtpPort;
  const secure = _email.smtpSecure === 'true';
  const user = _email.smtpUser;
  const pass = _email.smtpPassword;
  const cacheExpirySecondsStr = _email.smtpCacheExpirySeconds;

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
const testEmailAddress = configFields.runningUnderTest
  ? 'fake@gmail.com'
  : configHelpers.isBlank(_email.testEmailAddress)
    ? undefined
    : _email.testEmailAddress;

/**
 * The singleton configuration object. Prefer reading values from here.
 *
 * Note: intentionally not frozen so that tests can override individual values
 * at runtime (e.g. provisioning policy) via `config.<field> = ...`.
 */
export const config = {
  ...configFields,
  apiVersion: packageVersion,
  conductorServerId: slugify(configFields.conductorInstanceName),
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
  const keyfile = `${config.keyFilePath}/keys/${_keyFileHost}_private_key.pem`;
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
  const keyfile = `${config.keyFilePath}/keys/${_keyFileHost}_public_key.pem`;
  if (existsSync(keyfile)) {
    console.log(`Public key file ${keyfile} exists.`);
    return keyfile;
  }
  throw new Error(
    `Public key file ${keyfile} does not exist. Please run makeInstanceKeys.sh to generate keys.`
  );
}

/** Signing-key singleton. Tests may replace this export. */
export const keyService: IKeyService = getKeyService(config.keySource);

/** Email singleton. Tests may replace this export. */
export const emailService: IEmailService = createEmailService({
  serviceType: emailServiceType,
  emailConfig: email,
  serviceConfig:
    emailServiceType === EmailServiceType.SMTP
      ? resolveSmtpConfig()
      : undefined,
});
