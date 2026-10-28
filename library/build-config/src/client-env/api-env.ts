// SPDX-License-Identifier: Apache-2.0
/**
 * Layer 2 — Conductor API ENV schema.
 *
 * Required: CONDUCTOR_PUBLIC_URL, WEB_APP_PUBLIC_URL, COUCHDB_INTERNAL_URL,
 * COUCHDB_PUBLIC_URL, COUCHDB_USER, COUCHDB_PASSWORD, REDIRECT_WHITELIST.
 * Conditionally required: AWS_SECRET_KEY_ARN (KEY_SOURCE=AWS_SM);
 * SMTP_HOST / SMTP_USER / SMTP_PASSWORD (EMAIL_SERVICE_TYPE=SMTP, not under test).
 */
import {z} from 'zod';
import {readAuthProviderConfigFromEnv} from '../auth-provider-config.js';
import {
  optionalBool,
  optionalEnvString,
  boolWithDefault,
  enumWithDefault,
  intWithDefault,
  maxLongLivedDaysWithDefault,
  parseBugsnagKey,
  requiredEnvString,
  requiredEnvUrl,
  requiredUrlCsv,
  stringWithDefault,
} from '../env-coercion.js';
import {
  DownloadCookieSameSiteSchema,
  EmailServiceTypeSchema,
  KeySourceSchema,
  ProvisionSsoUsersPolicySchema,
  SHARED_DEFAULTS,
  resolveStartupMigrationLockEnabled,
  validateMigrationLock,
  type EmailServiceType,
} from '../shared-schemas.js';

/** From / reply headers used by the email service. */
export type ApiEmailConfig = {
  fromEmail: string;
  fromName: string;
  replyTo?: string;
};

/** Nodemailer-shaped SMTP settings; present only when emailServiceType is SMTP. */
export type ApiSmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  auth: {user: string; pass: string};
  cacheExpirySeconds: number;
};

const DEFAULT_FROM_EMAIL = 'noreply@example.com';
const DEFAULT_FROM_NAME = 'FAIMS System Notification';

/** Conductor `process.env` schema. AUTH_* providers are parsed separately. */
export const ApiEnvSchema = z
  .object({
    /** Public Conductor base URL. Required. */
    CONDUCTOR_PUBLIC_URL: requiredEnvUrl('CONDUCTOR_PUBLIC_URL'),
    /** Public data-collection app URL. Required. */
    WEB_APP_PUBLIC_URL: requiredEnvUrl('WEB_APP_PUBLIC_URL'),
    ANDROID_APP_PUBLIC_URL: optionalEnvString(),
    IOS_APP_PUBLIC_URL: optionalEnvString(),
    /** CouchDB URL from the API process. Required. */
    COUCHDB_INTERNAL_URL: requiredEnvUrl('COUCHDB_INTERNAL_URL'),
    /** CouchDB URL the app syncs to. Required. */
    COUCHDB_PUBLIC_URL: requiredEnvUrl('COUCHDB_PUBLIC_URL'),
    COUCHDB_USER: requiredEnvString('COUCHDB_USER'),
    COUCHDB_PASSWORD: requiredEnvString('COUCHDB_PASSWORD'),
    COUCHDB_EXTERNAL_PORT: intWithDefault(SHARED_DEFAULTS.couchdbExternalPort),
    CONDUCTOR_EXTERNAL_PORT: intWithDefault(
      SHARED_DEFAULTS.conductorExternalPort
    ),
    CONDUCTOR_INTERNAL_PORT: intWithDefault(
      SHARED_DEFAULTS.conductorInternalPort
    ),
    /** Allowed redirect origins (http(s) or app deep links). Required. */
    REDIRECT_WHITELIST: requiredUrlCsv('REDIRECT_WHITELIST'),
    /**
     * Auth profile / JWT key id. Blank stays blank so parseApiEnv can apply
     * the FILE-key fallbacks (kid `test`, host `conductor`).
     */
    PROFILE_NAME: optionalEnvString(),
    KEY_FILE_PATH: stringWithDefault('.'),
    /** Blank falls back to the resolved key id (PROFILE_NAME or `test`). */
    CONDUCTOR_INSTANCE_NAME: optionalEnvString(),
    CONDUCTOR_DESCRIPTION: stringWithDefault('FAIMS Conductor Server'),
    CONDUCTOR_SHORT_CODE_PREFIX: stringWithDefault('FAIMS'),
    FAIMS_COOKIE_SECRET: optionalEnvString(),
    KEY_SOURCE: enumWithDefault(KeySourceSchema, 'FILE'),
    /** Required when KEY_SOURCE=AWS_SM. */
    AWS_SECRET_KEY_ARN: optionalEnvString(),
    DISABLE_LOCAL_LOGIN: boolWithDefault(false),
    PROVISION_SSO_USERS_POLICY: enumWithDefault(
      ProvisionSsoUsersPolicySchema,
      'reject'
    ),
    ACCESS_TOKEN_EXPIRY_MINUTES: intWithDefault(
      SHARED_DEFAULTS.accessTokenExpiryMinutes
    ),
    REFRESH_TOKEN_EXPIRY_MINUTES: intWithDefault(
      SHARED_DEFAULTS.refreshTokenExpiryMinutes
    ),
    IMPERSONATION_SESSION_EXPIRY_MINUTES: intWithDefault(
      SHARED_DEFAULTS.impersonationSessionExpiryMinutes
    ),
    EMAIL_CODE_EXPIRY_MINUTES: intWithDefault(
      SHARED_DEFAULTS.emailCodeExpiryMinutes
    ),
    MAXIMUM_LONG_LIVED_DURATION_DAYS: maxLongLivedDaysWithDefault(
      SHARED_DEFAULTS.maximumLongLivedDurationDays
    ),
    DISABLE_MIGRATE_ON_STARTUP: boolWithDefault(false),
    STARTUP_MIGRATION_LOCK_ENABLED: optionalBool(),
    STARTUP_MIGRATION_LOCK_TIMEOUT_MS: intWithDefault(
      SHARED_DEFAULTS.startupMigrationLockTimeoutMs
    ),
    DEVELOPER_MODE: boolWithDefault(false),
    RATE_LIMITER_ENABLED: boolWithDefault(true),
    RATE_LIMITER_WINDOW_MS: intWithDefault(SHARED_DEFAULTS.rateLimiterWindowMs),
    RATE_LIMITER_PER_WINDOW: intWithDefault(
      SHARED_DEFAULTS.rateLimiterPerWindow
    ),
    EXPORT_RATE_LIMITER_ENABLED: boolWithDefault(true),
    EXPORT_RATE_LIMITER_WINDOW_MS: intWithDefault(
      SHARED_DEFAULTS.exportRateLimiterWindowMs
    ),
    EXPORT_RATE_LIMITER_PER_WINDOW: intWithDefault(
      SHARED_DEFAULTS.exportRateLimiterPerWindow
    ),
    ATTEMPT_LIMITER_ENABLED: boolWithDefault(true),
    /** Default SMTP; forced to MOCK under test. */
    EMAIL_SERVICE_TYPE: enumWithDefault(EmailServiceTypeSchema, 'SMTP'),
    EMAIL_FROM_ADDRESS: stringWithDefault('notifications@example.com'),
    EMAIL_FROM_NAME: stringWithDefault('FAIMS Notification'),
    EMAIL_REPLY_TO: optionalEnvString(),
    SMTP_HOST: optionalEnvString(),
    SMTP_PORT: intWithDefault(SHARED_DEFAULTS.smtpPort),
    /** Unset means STARTTLS (port 587); only an explicit truthy value enables implicit TLS. */
    SMTP_SECURE: boolWithDefault(false),
    SMTP_USER: optionalEnvString(),
    SMTP_PASSWORD: optionalEnvString(),
    SMTP_CACHE_EXPIRY_SECONDS: intWithDefault(
      SHARED_DEFAULTS.smtpCacheExpirySeconds
    ),
    TEST_EMAIL_ADDRESS: optionalEnvString(),
    BUGSNAG_API_KEY: optionalEnvString(),
    JSON_BODY_LIMIT: stringWithDefault(SHARED_DEFAULTS.jsonBodyLimit),
    URLENCODED_BODY_LIMIT: stringWithDefault(
      SHARED_DEFAULTS.urlencodedBodyLimit
    ),
    RESTORE_UPLOAD_MAX_BYTES: intWithDefault(
      SHARED_DEFAULTS.restoreUploadMaxBytes
    ),
    DOWNLOAD_COOKIE_SAMESITE: enumWithDefault(
      DownloadCookieSameSiteSchema,
      'lax'
    ),
    RECORDS_HYDRATED_PAGE_LIMIT: intWithDefault(
      SHARED_DEFAULTS.recordsHydratedPageLimit
    ),
  })
  .strip()
  .superRefine((data, ctx) => {
    if (data.KEY_SOURCE === 'AWS_SM' && !data.AWS_SECRET_KEY_ARN) {
      ctx.addIssue({
        code: 'custom',
        path: ['AWS_SECRET_KEY_ARN'],
        message: 'AWS_SECRET_KEY_ARN is not set but KEY_SOURCE is AWS_SM',
      });
    }
    validateMigrationLock(
      {
        disableMigrateOnStartup: data.DISABLE_MIGRATE_ON_STARTUP,
        startupMigrationLockEnabled: data.STARTUP_MIGRATION_LOCK_ENABLED,
      },
      ctx,
      ['STARTUP_MIGRATION_LOCK_ENABLED']
    );
  });

/** Parsed Conductor API environment variables. */
export type ApiEnv = z.infer<typeof ApiEnvSchema>;

/** Options for {@link parseApiEnv}. */
export interface ParseApiEnvOptions {
  /** Override NODE_ENV/JEST_WORKER_ID detection (forces MOCK email, disables export limiter). */
  runningUnderTest?: boolean;
}

/** Vitest/Jest set NODE_ENV=test or JEST_WORKER_ID; an explicit option wins. */
function isRunningUnderTest(
  raw: Record<string, unknown>,
  explicit?: boolean
): boolean {
  if (explicit !== undefined) return explicit;
  return raw.JEST_WORKER_ID !== undefined || raw.NODE_ENV === 'test';
}

/** Fail if SMTP_HOST / SMTP_USER / SMTP_PASSWORD are missing. */
function resolveSmtpConfig(env: ApiEnv): ApiSmtpConfig {
  const missing: string[] = [];
  if (!env.SMTP_HOST) missing.push('SMTP_HOST');
  if (!env.SMTP_USER) missing.push('SMTP_USER');
  if (!env.SMTP_PASSWORD) missing.push('SMTP_PASSWORD');
  if (missing.length > 0) {
    throw new Error(
      `SMTP configuration is incomplete. Missing required values: ${missing.join(', ')}.`
    );
  }
  return {
    host: env.SMTP_HOST!,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {user: env.SMTP_USER!, pass: env.SMTP_PASSWORD!},
    cacheExpirySeconds: env.SMTP_CACHE_EXPIRY_SECONDS,
  };
}

/**
 * Parse the Conductor API process environment into a typed runtime config.
 * Required endpoints, Couch credentials, and the redirect whitelist fail
 * fast when missing. SMTP credentials are required only when the service
 * type is SMTP and the process is not under test.
 */
export function parseApiEnv(
  raw: Record<string, unknown>,
  options: ParseApiEnvOptions = {}
) {
  const env = ApiEnvSchema.parse(raw);
  const runningUnderTest = isRunningUnderTest(raw, options.runningUnderTest);

  const profileName = (env.PROFILE_NAME ?? '').trim();
  const conductorKeyId = profileName === '' ? 'test' : profileName;
  const keyFileHost = profileName === '' ? 'conductor' : profileName;
  const conductorInstanceName =
    (env.CONDUCTOR_INSTANCE_NAME ?? '').trim() || conductorKeyId;

  const emailServiceType: EmailServiceType = runningUnderTest
    ? 'MOCK'
    : env.EMAIL_SERVICE_TYPE;

  const email: ApiEmailConfig = {
    fromEmail: env.EMAIL_FROM_ADDRESS || DEFAULT_FROM_EMAIL,
    fromName: env.EMAIL_FROM_NAME || DEFAULT_FROM_NAME,
    replyTo: env.EMAIL_REPLY_TO,
  };

  const smtp = emailServiceType === 'SMTP' ? resolveSmtpConfig(env) : undefined;

  return {
    conductorPublicUrl: env.CONDUCTOR_PUBLIC_URL,
    webAppPublicUrl: env.WEB_APP_PUBLIC_URL,
    androidAppUrl: env.ANDROID_APP_PUBLIC_URL ?? '',
    iosAppUrl: env.IOS_APP_PUBLIC_URL ?? '',
    couchdbInternalUrl: env.COUCHDB_INTERNAL_URL,
    couchdbPublicUrl: env.COUCHDB_PUBLIC_URL,
    conductorInternalPort: env.CONDUCTOR_INTERNAL_PORT,
    conductorExternalPort: env.CONDUCTOR_EXTERNAL_PORT,
    instanceDescription: env.CONDUCTOR_DESCRIPTION,
    shortCodePrefix: env.CONDUCTOR_SHORT_CODE_PREFIX,
    keySource: env.KEY_SOURCE,
    awsSecretKeyArn: env.AWS_SECRET_KEY_ARN,
    provisionSSOUsersPolicy: env.PROVISION_SSO_USERS_POLICY,
    localLoginEnabled: !env.DISABLE_LOCAL_LOGIN,
    cookieSecret: env.FAIMS_COOKIE_SECRET ?? crypto.randomUUID(),
    authProviderConfig: readAuthProviderConfigFromEnv(raw),
    accessTokenExpiryMinutes: env.ACCESS_TOKEN_EXPIRY_MINUTES,
    refreshTokenExpiryMinutes: env.REFRESH_TOKEN_EXPIRY_MINUTES,
    impersonationSessionExpiryMinutes: env.IMPERSONATION_SESSION_EXPIRY_MINUTES,
    emailCodeExpiryMinutes: env.EMAIL_CODE_EXPIRY_MINUTES,
    maximumLongLivedDurationDays:
      env.MAXIMUM_LONG_LIVED_DURATION_DAYS === 'unlimited'
        ? undefined
        : env.MAXIMUM_LONG_LIVED_DURATION_DAYS,
    disableMigrateOnStartup: env.DISABLE_MIGRATE_ON_STARTUP,
    startupMigrationLockEnabled:
      resolveStartupMigrationLockEnabled(
        env.DISABLE_MIGRATE_ON_STARTUP,
        env.STARTUP_MIGRATION_LOCK_ENABLED
      ) ?? false,
    startupMigrationLockTimeoutMs: env.STARTUP_MIGRATION_LOCK_TIMEOUT_MS,
    rateLimiterWindowMs: env.RATE_LIMITER_WINDOW_MS,
    rateLimiterPerWindow: env.RATE_LIMITER_PER_WINDOW,
    rateLimiterEnabled: env.RATE_LIMITER_ENABLED,
    exportRateLimiterEnabled: runningUnderTest
      ? false
      : env.EXPORT_RATE_LIMITER_ENABLED,
    exportRateLimiterWindowMs: env.EXPORT_RATE_LIMITER_WINDOW_MS,
    exportRateLimiterPerWindow: env.EXPORT_RATE_LIMITER_PER_WINDOW,
    authAttemptLimiterEnabled: env.ATTEMPT_LIMITER_ENABLED,
    jsonBodyLimit: env.JSON_BODY_LIMIT,
    urlencodedBodyLimit: env.URLENCODED_BODY_LIMIT,
    restoreUploadMaxBytes: env.RESTORE_UPLOAD_MAX_BYTES,
    recordsHydratedPageLimit: Math.min(
      env.RECORDS_HYDRATED_PAGE_LIMIT,
      SHARED_DEFAULTS.recordsHydratedPageLimitMax
    ),
    downloadCookieSameSite: env.DOWNLOAD_COOKIE_SAMESITE,
    developerMode: env.DEVELOPER_MODE,
    bugsnagApiKey: parseBugsnagKey(env.BUGSNAG_API_KEY),
    conductorKeyId,
    conductorInstanceName,
    keyFilePath: env.KEY_FILE_PATH,
    keyFileHost,
    localCouchdbAuth: {
      username: env.COUCHDB_USER,
      password: env.COUCHDB_PASSWORD,
    },
    runningUnderTest,
    redirectWhitelist: env.REDIRECT_WHITELIST,
    emailServiceType,
    email,
    smtp,
    testEmailAddress: runningUnderTest
      ? (env.TEST_EMAIL_ADDRESS ?? 'fake@gmail.com')
      : env.TEST_EMAIL_ADDRESS,
  };
}

/** Typed Conductor runtime config produced by {@link parseApiEnv}. */
export type ApiRuntimeConfig = ReturnType<typeof parseApiEnv>;
