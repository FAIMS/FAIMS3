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
  boolWithDefault,
  capacityScaleThresholdsWithDefault,
  enumWithDefault,
  gdalNumThreadsWithDefault,
  intWithDefault,
  maxLongLivedDaysWithDefault,
  nonNegativeIntWithDefault,
  optionalBool,
  optionalEnvString,
  optionalNonNegativeInt,
  optionalPositiveInt,
  OptionalCsvSchema,
  parseBugsnagKey,
  requiredEnvString,
  requiredEnvUrl,
  requiredUrlCsv,
  stringWithDefault,
} from '../env-coercion.js';
import {
  AttachmentStorageTypeSchema,
  CapacityProviderTypeSchema,
  DownloadCookieSameSiteSchema,
  EmailServiceTypeSchema,
  KeySourceSchema,
  ProvisionSsoUsersPolicySchema,
  SHARED_DEFAULTS,
  defaultScaleInCooldownMs,
  resolveStartupMigrationLockEnabled,
  validateMigrationLock,
  type AttachmentStorageType,
  type CapacityProviderType,
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

/** Object-store settings for map-layer files. */
export type ApiAttachmentStorageConfig = {
  bucket: string;
  prefix: string;
  region: string;
  endpoint?: string;
  publicEndpoint?: string;
  forcePathStyle?: boolean;
  accessKeyId?: string;
  secretAccessKey?: string;
};

/** ECS RunTask settings; present only when capacityProviderType is ECS. */
export type ApiEcsCapacityConfig = {
  cluster: string;
  taskDefinition: string;
  taskFamily: string;
  containerName: string;
  subnets: string[];
  securityGroups: string[];
  assignPublicIp: 'ENABLED' | 'DISABLED';
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
    /**
     * Skip API-boot Couch migrate. Forced on under test in
     * {@link parseApiEnv} so unit tests never walk Couch on import.
     */
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
    /** Start the 1 Hz stdout memory sampler for leak hunts. */
    MEMORY_MONITOR_ENABLED: boolWithDefault(false),
    /** Write Morgan combined-format HTTP access lines. */
    REQUEST_LOGGING_ENABLED: boolWithDefault(true),
    /** Object-store backend for map-layer files (`S3` or `MOCK`). */
    ATTACHMENT_STORAGE_TYPE: enumWithDefault(AttachmentStorageTypeSchema, 'S3'),
    /** Required when ATTACHMENT_STORAGE_TYPE is S3 (not under test). */
    ATTACHMENT_S3_BUCKET: optionalEnvString(),
    /** Required when ATTACHMENT_STORAGE_TYPE is S3 (not under test). */
    ATTACHMENT_S3_PREFIX: optionalEnvString(),
    /** Required when ATTACHMENT_STORAGE_TYPE is S3 (not under test). */
    ATTACHMENT_S3_REGION: optionalEnvString(),
    /** Custom S3 endpoint (RustFS, MinIO, Spaces). Omit for AWS S3. */
    ATTACHMENT_S3_ENDPOINT: optionalEnvString(),
    /** Host-visible S3 endpoint used when signing download URLs. */
    ATTACHMENT_S3_PUBLIC_ENDPOINT: optionalEnvString(),
    /** Path-style S3 URLs. Defaults to true when an endpoint is set. */
    ATTACHMENT_S3_FORCE_PATH_STYLE: optionalBool(),
    /** Optional static access key. Omit on ECS so the task role is used. */
    ATTACHMENT_S3_ACCESS_KEY_ID: optionalEnvString(),
    /** Optional static secret key. Omit on ECS so the task role is used. */
    ATTACHMENT_S3_SECRET_ACCESS_KEY: optionalEnvString(),
    /** Spatial worker capacity provider (`FIXED`, `ECS`, or `MOCK`). */
    CAPACITY_PROVIDER: enumWithDefault(CapacityProviderTypeSchema, 'FIXED'),
    /** Max workers the capacity manager will ask for at once. */
    CAPACITY_MAX: intWithDefault(SHARED_DEFAULTS.capacityMax),
    /** Queue depths at which worker count increases from 1. */
    CAPACITY_SCALE_THRESHOLDS: capacityScaleThresholdsWithDefault(
      SHARED_DEFAULTS.capacityScaleThresholdsCsv
    ),
    /** How often the capacity manager reconciles queue depth (ms). */
    CAPACITY_RECONCILE_MS: intWithDefault(SHARED_DEFAULTS.capacityReconcileMs),
    /** Age of oldest unclaimed job before asking for the first extra worker (`0` disables). */
    CAPACITY_STARVATION_MS: nonNegativeIntWithDefault(
      SHARED_DEFAULTS.capacityStarvationMs
    ),
    /** Cooldown before another extra worker from the same stale job (`0` keeps only first extra). */
    CAPACITY_SCALE_IN_COOLDOWN_MS: optionalNonNegativeInt(
      'CAPACITY_SCALE_IN_COOLDOWN_MS'
    ),
    /** Replica count reported by the FIXED capacity provider. */
    CAPACITY_FIXED_REPLICAS: intWithDefault(
      SHARED_DEFAULTS.capacityFixedReplicas
    ),
    /** ECS cluster name or ARN (required when CAPACITY_PROVIDER is ECS). */
    CAPACITY_ECS_CLUSTER: optionalEnvString(),
    /** Worker task definition ARN passed to RunTask. */
    CAPACITY_ECS_WORKER_TASK_DEFINITION: optionalEnvString(),
    /** Worker task definition family used to list running and pending tasks. */
    CAPACITY_ECS_WORKER_TASK_FAMILY: optionalEnvString(),
    /** Container name inside the worker task definition. */
    CAPACITY_ECS_WORKER_CONTAINER: optionalEnvString(),
    /** Comma-separated subnet ids for RunTask awsvpc networking. */
    CAPACITY_ECS_SUBNETS: optionalEnvString(),
    /** Comma-separated security group ids for RunTask. */
    CAPACITY_ECS_SECURITY_GROUPS: optionalEnvString(),
    /** `ENABLED` or `DISABLED`. Default `ENABLED`. */
    CAPACITY_ECS_ASSIGN_PUBLIC_IP: optionalEnvString(),
    /** Spatial worker exits after this many ms with no job (`0` never exits). */
    SPATIAL_WORKER_IDLE_EXIT_MS: nonNegativeIntWithDefault(
      SHARED_DEFAULTS.spatialWorkerIdleExitMs
    ),
    /** Delay between empty spatial-worker polls (ms). */
    SPATIAL_WORKER_POLL_MS: intWithDefault(SHARED_DEFAULTS.spatialWorkerPollMs),
    /** GDAL worker threads (`ALL_CPUS` or a positive integer). */
    GDAL_NUM_THREADS: gdalNumThreadsWithDefault(SHARED_DEFAULTS.gdalNumThreads),
    /** Raster block cache in megabytes (`GDAL_CACHEMAX`). */
    GDAL_CACHEMAX: intWithDefault(SHARED_DEFAULTS.gdalCacheMaxMb),
    /** `gdalwarp -wm` working buffer in megabytes. */
    GDAL_WARP_MEMORY_MB: intWithDefault(SHARED_DEFAULTS.gdalWarpMemoryMb),
    /** `gdalwarp -multi`: overlap I/O with compute. */
    GDAL_WARP_MULTI: boolWithDefault(SHARED_DEFAULTS.gdalWarpMulti),
    /** Cap tippecanoe threads. Blank = all CPUs. */
    TIPPECANOE_MAX_THREADS: optionalPositiveInt('TIPPECANOE_MAX_THREADS'),
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
  /**
   * Override NODE_ENV/JEST_WORKER_ID detection. Under test: MOCK email,
   * export limiter off, and `disableMigrateOnStartup` forced on so API unit
   * tests never walk Couch or notebook JSON on import.
   */
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

const TEST_ATTACHMENT_STORAGE_CONFIG: ApiAttachmentStorageConfig = {
  bucket: 'test-map-assets',
  prefix: 'map-assets',
  region: 'us-east-1',
};

/** Fail if ATTACHMENT_S3_BUCKET / ATTACHMENT_S3_PREFIX / ATTACHMENT_S3_REGION are missing. */
function resolveAttachmentStorageConfig(
  env: ApiEnv
): ApiAttachmentStorageConfig {
  const bucket = env.ATTACHMENT_S3_BUCKET;
  const prefix = env.ATTACHMENT_S3_PREFIX;
  const region = env.ATTACHMENT_S3_REGION;
  const endpoint = env.ATTACHMENT_S3_ENDPOINT;
  const publicEndpoint = env.ATTACHMENT_S3_PUBLIC_ENDPOINT;
  const accessKeyId = env.ATTACHMENT_S3_ACCESS_KEY_ID;
  const secretAccessKey = env.ATTACHMENT_S3_SECRET_ACCESS_KEY;
  const forcePathStyle =
    env.ATTACHMENT_S3_FORCE_PATH_STYLE ?? endpoint !== undefined;

  const missing: string[] = [];
  if (!bucket) missing.push('ATTACHMENT_S3_BUCKET');
  if (!prefix) missing.push('ATTACHMENT_S3_PREFIX');
  if (!region) missing.push('ATTACHMENT_S3_REGION');
  if (missing.length > 0) {
    const providedConfig = {
      ATTACHMENT_S3_BUCKET: bucket || '[missing]',
      ATTACHMENT_S3_PREFIX: prefix || '[missing]',
      ATTACHMENT_S3_REGION: region || '[missing]',
      ATTACHMENT_S3_ENDPOINT: endpoint || '[not set — AWS S3]',
      ATTACHMENT_S3_PUBLIC_ENDPOINT:
        publicEndpoint || '[not set — same as endpoint]',
      ATTACHMENT_S3_FORCE_PATH_STYLE:
        env.ATTACHMENT_S3_FORCE_PATH_STYLE !== undefined
          ? String(env.ATTACHMENT_S3_FORCE_PATH_STYLE)
          : '[default]',
      ATTACHMENT_S3_ACCESS_KEY_ID: accessKeyId
        ? '[provided]'
        : '[not set — default credential chain]',
      ATTACHMENT_S3_SECRET_ACCESS_KEY: secretAccessKey
        ? '[provided]'
        : '[not set — default credential chain]',
    };
    throw new Error(
      `Attachment storage configuration is incomplete. Missing required values: ${missing.join(', ')}.\n` +
        `Provided configuration: ${JSON.stringify(providedConfig, null, 2)}`
    );
  }

  return {
    bucket: bucket!,
    prefix: prefix!,
    region: region!,
    endpoint,
    publicEndpoint,
    forcePathStyle,
    accessKeyId,
    secretAccessKey,
  };
}

/** Fail if ECS RunTask env is incomplete when CAPACITY_PROVIDER is ECS. */
function resolveEcsCapacityConfig(env: ApiEnv): ApiEcsCapacityConfig {
  const cluster = env.CAPACITY_ECS_CLUSTER;
  const taskDefinition = env.CAPACITY_ECS_WORKER_TASK_DEFINITION;
  const taskFamily = env.CAPACITY_ECS_WORKER_TASK_FAMILY;
  const containerName = env.CAPACITY_ECS_WORKER_CONTAINER;
  const subnets = OptionalCsvSchema.parse(env.CAPACITY_ECS_SUBNETS ?? '');
  const securityGroups = OptionalCsvSchema.parse(
    env.CAPACITY_ECS_SECURITY_GROUPS ?? ''
  );
  const assignRaw = (env.CAPACITY_ECS_ASSIGN_PUBLIC_IP ?? 'ENABLED')
    .trim()
    .toUpperCase();

  const missing: string[] = [];
  if (!cluster) missing.push('CAPACITY_ECS_CLUSTER');
  if (!taskDefinition) missing.push('CAPACITY_ECS_WORKER_TASK_DEFINITION');
  if (!taskFamily) missing.push('CAPACITY_ECS_WORKER_TASK_FAMILY');
  if (!containerName) missing.push('CAPACITY_ECS_WORKER_CONTAINER');
  if (subnets.length === 0) missing.push('CAPACITY_ECS_SUBNETS');
  if (securityGroups.length === 0) missing.push('CAPACITY_ECS_SECURITY_GROUPS');
  if (assignRaw !== 'ENABLED' && assignRaw !== 'DISABLED') {
    missing.push('CAPACITY_ECS_ASSIGN_PUBLIC_IP (ENABLED or DISABLED)');
  }
  if (missing.length > 0) {
    throw new Error(
      `ECS capacity configuration is incomplete. Missing required values: ${missing.join(', ')}.`
    );
  }

  return {
    cluster: cluster!,
    taskDefinition: taskDefinition!,
    taskFamily: taskFamily!,
    containerName: containerName!,
    subnets,
    securityGroups,
    assignPublicIp: assignRaw as 'ENABLED' | 'DISABLED',
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

  const attachmentStorageType: AttachmentStorageType = runningUnderTest
    ? 'MOCK'
    : env.ATTACHMENT_STORAGE_TYPE;
  const attachmentStorage =
    attachmentStorageType === 'S3'
      ? resolveAttachmentStorageConfig(env)
      : TEST_ATTACHMENT_STORAGE_CONFIG;

  const capacityProviderType: CapacityProviderType = runningUnderTest
    ? 'MOCK'
    : env.CAPACITY_PROVIDER;
  const capacityEcs =
    capacityProviderType === 'ECS' ? resolveEcsCapacityConfig(env) : undefined;

  // API unit tests import the Express app without the production boot path,
  // but still share this singleton. Force-skip Couch + notebook startup
  // migrate so fixture restores keep their on-disk schema and tests that
  // need a walk call it explicitly.
  const disableMigrateOnStartup = runningUnderTest
    ? true
    : env.DISABLE_MIGRATE_ON_STARTUP;

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
    disableMigrateOnStartup,
    startupMigrationLockEnabled:
      resolveStartupMigrationLockEnabled(
        disableMigrateOnStartup,
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
    memoryMonitorEnabled: env.MEMORY_MONITOR_ENABLED,
    requestLoggingEnabled: env.REQUEST_LOGGING_ENABLED,
    attachmentStorageType,
    attachmentStorage,
    capacityProviderType,
    /** Present when {@link capacityProviderType} is ECS. */
    capacityEcs,
    capacityMax: env.CAPACITY_MAX,
    capacityScaleThresholds: env.CAPACITY_SCALE_THRESHOLDS,
    capacityReconcileMs: env.CAPACITY_RECONCILE_MS,
    capacityStarvationMs: env.CAPACITY_STARVATION_MS,
    capacityScaleInCooldownMs:
      env.CAPACITY_SCALE_IN_COOLDOWN_MS ??
      defaultScaleInCooldownMs(env.CAPACITY_STARVATION_MS),
    capacityFixedReplicas: env.CAPACITY_FIXED_REPLICAS,
    spatialWorkerIdleExitMs: env.SPATIAL_WORKER_IDLE_EXIT_MS,
    spatialWorkerPollMs: env.SPATIAL_WORKER_POLL_MS,
    gdalNumThreads: env.GDAL_NUM_THREADS,
    gdalCacheMaxMb: env.GDAL_CACHEMAX,
    gdalWarpMemoryMb: env.GDAL_WARP_MEMORY_MB,
    gdalWarpMulti: env.GDAL_WARP_MULTI,
    tippecanoeMaxThreads: env.TIPPECANOE_MAX_THREADS,
  };
}

/** Typed Conductor runtime config produced by {@link parseApiEnv}. */
export type ApiRuntimeConfig = ReturnType<typeof parseApiEnv>;
