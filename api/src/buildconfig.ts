// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: buildconfig.ts
 * Description:
 *   This module exports the configuration of the build, including things like
 *   which server to use and whether to include test data.
 *   Configuration is parsed from `process.env` with a single zod schema:
 *     - Each env key is declared once with its coercion / defaulting logic and
 *       is the place to document that setting.
 *     - `.strip()` drops unrelated process.env keys.
 *     - A final `.transform()` renames ENV_KEYS into the camelCase `config` shape
 *       (and builds a few cross-field / required values). Do not re-document
 *       env-backed fields in the transform.
 *   Prefer importing `{config}` and reading `config.<field>`. Service singletons
 *   (`keyService`, `emailService`) and lazy key-file path helpers remain as
 *   dedicated exports for DI / test replacement.
 */

import {
  configHelpers,
  RECORDS_HYDRATED_PAGE_LIMIT_DEFAULT,
  RECORDS_HYDRATED_PAGE_LIMIT_MAX,
  slugify,
} from '@faims3/data-model';
import {existsSync} from 'fs';
import {z} from 'zod';
import {
  AttachmentStorageConfig,
  AttachmentStorageType,
  createAttachmentStorageService,
  IAttachmentStorageService,
} from './services/attachmentStorageService';
import {
  CapacityProviderType,
  EcsCapacityProviderConfig,
} from './services/capacityProvider';
import {
  DEFAULT_GDAL_CACHE_MAX_MB,
  DEFAULT_GDAL_NUM_THREADS,
  DEFAULT_GDAL_WARP_MEMORY_MB,
  DEFAULT_GDAL_WARP_MULTI,
} from './spatial/gdalPerformance';
import {
  DEFAULT_CAPACITY_SCALE_THRESHOLDS_CSV,
  parseCapacityScaleThresholds,
} from './spatial/reconcileCapacity';
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
import {STARTUP_MIGRATION_LOCK_TIMEOUT_MS as DEFAULT_STARTUP_MIGRATION_LOCK_TIMEOUT_MS} from './couchdb/startupMigrationLock';

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
// Export mint/redeem: same window, much tighter cap (ZIP / GDAL / Couch scans).
export const DEFAULT_EXPORT_RATE_LIMITER_WINDOW_MS = 10 * 60 * 1000;
export const DEFAULT_EXPORT_RATE_LIMITER_PER_WINDOW = 20;
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
    /**
     * Prefix used when generating invite codes (e.g. `FAIMS` → `FAIMS-…`).
     */
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
    /**
     * Skip API-boot Couch migrate and notebook uiSpec walks entirely
     * (`DISABLE_MIGRATE_ON_STARTUP`). Blank → off (migrate still runs).
     * When true, `runStartupMigrations` returns immediately and the
     * lock is never claimed. Use for local/debug boots against an
     * already-migrated DB, or when migrate is run out of band
     * (`pnpm migrate-with-keys`). Accepts true/1/on/yes or
     * false/0/off/no; unrecognised values fail parse.
     */
    DISABLE_MIGRATE_ON_STARTUP: configHelpers.boolWithDefault(false),
    /**
     * Couch-mediated claim/wait/steal around API-boot migrations
     * (`STARTUP_MIGRATION_LOCK_ENABLED`). Blank → off. Clustered /
     * multi-replica production MUST enable this so replicas do not race
     * migrate. Default off so local `pnpm run dev` reloads do not wait
     * on a `running` lock left by a killed process (steal timeout is
     * 30 minutes). Ignored when DISABLE_MIGRATE_ON_STARTUP is on.
     * Accepts true/1/on/yes or false/0/off/no; unrecognised values
     * fail parse.
     */
    STARTUP_MIGRATION_LOCK_ENABLED: configHelpers.boolWithDefault(false),
    /**
     * Age of a still-`running` lock after which a waiter steals it and
     * runs migrate itself (milliseconds). Timeout is not "skip migrate
     * and attach". Age is `now - startedAtMs` (no heartbeat); the
     * original doer is not cancelled. Default 30 minutes. Only used
     * when STARTUP_MIGRATION_LOCK_ENABLED is on.
     */
    STARTUP_MIGRATION_LOCK_TIMEOUT_MS: configHelpers.intDefault(
      DEFAULT_STARTUP_MIGRATION_LOCK_TIMEOUT_MS,
      'STARTUP_MIGRATION_LOCK_TIMEOUT_MS'
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
    /**
     * Whether the Express HTTP IP rate limiter is enabled. Blank → on;
     * unrecognised values fail parse (do not silently disable). Does not
     * control CouchDB-backed auth attempt limits — see
     * ATTEMPT_LIMITER_ENABLED.
     */
    RATE_LIMITER_ENABLED: configHelpers.boolWithDefault(true),
    /**
     * Dedicated limiter for notebook export mint/redeem routes. Independent
     * of RATE_LIMITER_ENABLED so ZIP/GDAL work stays capped when the global
     * IP limiter is off (upstream WAF). Blank → on; unrecognised values fail
     * parse. Tests force this off at transform time unless a test opts in.
     */
    EXPORT_RATE_LIMITER_ENABLED: configHelpers.boolWithDefault(true),
    /** Export-limiter window duration in milliseconds. */
    EXPORT_RATE_LIMITER_WINDOW_MS: configHelpers.intDefault(
      DEFAULT_EXPORT_RATE_LIMITER_WINDOW_MS,
      'EXPORT_RATE_LIMITER_WINDOW_MS'
    ),
    /** Export mint/redeem requests allowed per export-limiter window. */
    EXPORT_RATE_LIMITER_PER_WINDOW: configHelpers.intDefault(
      DEFAULT_EXPORT_RATE_LIMITER_PER_WINDOW,
      'EXPORT_RATE_LIMITER_PER_WINDOW'
    ),
    /**
     * Whether per-user email-code / verification-challenge attempt limits
     * are enabled. Independent of the HTTP IP limiter so deployments that
     * disable RATE_LIMITER_ENABLED upstream still keep password-reset and
     * verification brute-force protection. Blank → on; unrecognised values
     * fail parse (do not silently disable). E2e may set false for repeated
     * auth flows.
     */
    ATTEMPT_LIMITER_ENABLED: configHelpers.boolWithDefault(true),
    /**
     * When true, start a 1 Hz stdout memory sampler with leak-oriented
     * diagnostics (heap/RSS deltas, moving averages, peaks, detached
     * contexts, event-loop lag). Blank → off. Unrecognised values fail
     * parse. Intended for local/debug leak hunts — noisy at 1 Hz.
     */
    MEMORY_MONITOR_ENABLED: configHelpers.boolWithDefault(false),
    /**
     * Whether morgan writes a combined-format access line for every HTTP
     * request. Blank → on; unrecognised values fail parse. Set false to
     * quiet stdout when structured audit logs (map-asset processing,
     * invites, downloads) are enough. Does not affect those audit lines.
     */
    REQUEST_LOGGING_ENABLED: configHelpers.boolWithDefault(true),
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
     * Object-store backend for map-layer files (`S3` or `MOCK`). Blank → S3.
     * Forced to MOCK under test. S3 also talks to RustFS when
     * ATTACHMENT_S3_ENDPOINT is set.
     */
    ATTACHMENT_STORAGE_TYPE: configHelpers.nativeEnumDefault(
      AttachmentStorageType,
      AttachmentStorageType.S3
    ),
    /** Bucket that holds map-layer objects (required when type is S3). */
    ATTACHMENT_S3_BUCKET: z.string().optional(),
    /**
     * Key prefix inside the bucket, e.g. `map-assets` (required when type
     * is S3). Leading/trailing slashes are stripped.
     */
    ATTACHMENT_S3_PREFIX: z.string().optional(),
    /**
     * AWS region, or a dummy region for RustFS (required when type is S3).
     */
    ATTACHMENT_S3_REGION: z.string().optional(),
    /**
     * Custom S3 endpoint (RustFS, MinIO). Omit for AWS S3. Native local
     * dev uses `http://localhost:9000`; Docker `--all` uses
     * `http://rustfs:9000`.
     */
    ATTACHMENT_S3_ENDPOINT: z.string().optional(),
    /**
     * Host-visible S3 endpoint used when signing download URLs. Needed
     * when the API talks to RustFS as `http://rustfs:9000` but browsers
     * fetch `http://localhost:9000`. Omit when the signing host is
     * already reachable (native `./dev.sh`, AWS S3).
     */
    ATTACHMENT_S3_PUBLIC_ENDPOINT: z.string().optional(),
    /**
     * Path-style S3 URLs (`true` / other). Default true when an endpoint
     * is set (required for RustFS).
     */
    ATTACHMENT_S3_FORCE_PATH_STYLE: z.string().optional(),
    /**
     * Optional static access key. Omit on ECS so the task role is used.
     * Required for local RustFS.
     */
    ATTACHMENT_S3_ACCESS_KEY_ID: z.string().optional(),
    /**
     * Optional static secret key. Omit on ECS so the task role is used.
     */
    ATTACHMENT_S3_SECRET_ACCESS_KEY: z.string().optional(),
    /**
     * Who turns the Couch map-asset queue into workers.
     * `FIXED` (default) — always-on pool; the manager does not start tasks.
     * `ECS` — capacity manager calls RunTask. `MOCK` is forced under test.
     */
    CAPACITY_PROVIDER: configHelpers.nativeEnumDefault(
      CapacityProviderType,
      CapacityProviderType.FIXED
    ),
    /** Max workers the capacity manager will ask for at once. */
    CAPACITY_MAX: configHelpers.intDefault(4, 'CAPACITY_MAX'),
    /**
     * Queue depths at which worker count increases from 1.
     * `3,8,16,32` means 1→2 at 3 jobs, 2→3 at 8, 3→4 at 16, 4→5 at 32.
     * Always capped by CAPACITY_MAX.
     */
    CAPACITY_SCALE_THRESHOLDS: z
      .string()
      .optional()
      .transform((v, ctx) => {
        const raw = configHelpers.isBlank(v)
          ? DEFAULT_CAPACITY_SCALE_THRESHOLDS_CSV
          : v;
        try {
          return parseCapacityScaleThresholds(raw);
        } catch (error) {
          ctx.addIssue({
            code: 'custom',
            message: error instanceof Error ? error.message : String(error),
          });
          return z.NEVER;
        }
      }),
    /** How often the capacity manager reconciles queue depth (ms). */
    CAPACITY_RECONCILE_MS: configHelpers.intDefault(
      15_000,
      'CAPACITY_RECONCILE_MS'
    ),
    /** Replica count reported by the FIXED provider. It does not start tasks. */
    CAPACITY_FIXED_REPLICAS: configHelpers.intDefault(
      1,
      'CAPACITY_FIXED_REPLICAS'
    ),
    /** ECS cluster name or ARN. Required when CAPACITY_PROVIDER is ECS. */
    CAPACITY_ECS_CLUSTER: z.string().optional(),
    /** Worker task definition ARN passed to RunTask. */
    CAPACITY_ECS_WORKER_TASK_DEFINITION: z.string().optional(),
    /** Worker task definition family used to list running and pending tasks. */
    CAPACITY_ECS_WORKER_TASK_FAMILY: z.string().optional(),
    /** Container name inside the worker task definition. */
    CAPACITY_ECS_WORKER_CONTAINER: z.string().optional(),
    /** Comma-separated subnet ids for RunTask awsvpc networking. */
    CAPACITY_ECS_SUBNETS: z.string().optional(),
    /** Comma-separated security group ids for RunTask. */
    CAPACITY_ECS_SECURITY_GROUPS: z.string().optional(),
    /** `ENABLED` or `DISABLED`. Default ENABLED (public subnets, no NAT). */
    CAPACITY_ECS_ASSIGN_PUBLIC_IP: z.string().optional(),
    /**
     * Spatial worker exits after this many ms with no job. `0` never exits
     * (compose / on-prem). AWS default is 60s so Fargate returns to zero.
     */
    SPATIAL_WORKER_IDLE_EXIT_MS: configHelpers.intDefault(
      60_000,
      'SPATIAL_WORKER_IDLE_EXIT_MS'
    ),
    /** Delay between empty spatial-worker polls. */
    SPATIAL_WORKER_POLL_MS: configHelpers.intDefault(
      5_000,
      'SPATIAL_WORKER_POLL_MS'
    ),
    /**
     * GDAL worker threads for warp / overviews / compression.
     * `ALL_CPUS` (default) or a positive integer. Scales with task vCPU.
     */
    GDAL_NUM_THREADS: z
      .string()
      .optional()
      .transform((v, ctx) => {
        if (configHelpers.isBlank(v)) {
          return DEFAULT_GDAL_NUM_THREADS;
        }
        const upper = v.trim().toUpperCase();
        if (upper === 'ALL_CPUS') {
          return 'ALL_CPUS';
        }
        const parsed = parseInt(v, 10);
        if (!Number.isInteger(parsed) || parsed < 1) {
          ctx.addIssue({
            code: 'custom',
            message: 'GDAL_NUM_THREADS must be ALL_CPUS or a positive integer',
          });
          return z.NEVER;
        }
        return String(parsed);
      }),
    /**
     * Raster block cache in megabytes (`GDAL_CACHEMAX`). Values below
     * 100000 are MB. Default 256 fits a 2 GiB worker; raise on large tasks.
     */
    GDAL_CACHEMAX: configHelpers
      .intDefault(DEFAULT_GDAL_CACHE_MAX_MB, 'GDAL_CACHEMAX')
      .refine(n => n > 0, {
        message: 'GDAL_CACHEMAX must be a positive integer',
      }),
    /**
     * `gdalwarp -wm` working buffer in megabytes. Shared across warp
     * threads — raise this when GDAL_NUM_THREADS > 1. Default 256.
     */
    GDAL_WARP_MEMORY_MB: configHelpers
      .intDefault(DEFAULT_GDAL_WARP_MEMORY_MB, 'GDAL_WARP_MEMORY_MB')
      .refine(n => n > 0, {
        message: 'GDAL_WARP_MEMORY_MB must be a positive integer',
      }),
    /**
     * `gdalwarp -multi`: overlap I/O with compute (two threads). Default on.
     */
    GDAL_WARP_MULTI: configHelpers.boolWithDefault(DEFAULT_GDAL_WARP_MULTI),
    /**
     * Cap tippecanoe threads. Blank = all CPUs (tippecanoe's default).
     */
    TIPPECANOE_MAX_THREADS: z
      .string()
      .optional()
      .transform((v, ctx) => {
        if (configHelpers.isBlank(v)) {
          return undefined;
        }
        const parsed = parseInt(v, 10);
        if (!Number.isInteger(parsed) || parsed < 1) {
          ctx.addIssue({
            code: 'custom',
            message: 'TIPPECANOE_MAX_THREADS must be a positive integer',
          });
          return z.NEVER;
        }
        return parsed;
      }),
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
    /**
     * SameSite for the export download-grant cookie. `lax` (default) is
     * enough when Control Centre and Conductor share an eTLD+1 (effective
     * top-level domain plus one label — the registrable domain browsers
     * treat as one cookie site, e.g. `example.com` for `app.example.com`
     * and `api.example.com`). Use `none` (always Secure) when they sit on
     * different registrable domains.
     */
    DOWNLOAD_COOKIE_SAMESITE: configHelpers.enumDefault(
      ['lax', 'none'] as const,
      'lax'
    ),
    /**
     * Max records per GET …/records/hydrated page. Default 150; clamped to
     * 1–500. Hydrated pages carry full field payloads (e.g. MapFormField
     * polygons), so this stays well below the metadata list cap of 500.
     */
    RECORDS_HYDRATED_PAGE_LIMIT: z
      .string()
      .optional()
      .transform((v): number => {
        if (configHelpers.isBlank(v)) {
          return RECORDS_HYDRATED_PAGE_LIMIT_DEFAULT;
        }
        const parsed = parseInt(v, 10);
        if (Number.isNaN(parsed) || parsed < 1) {
          console.warn(
            `Invalid value "${v}" for RECORDS_HYDRATED_PAGE_LIMIT. Must be a positive integer. Falling back to default ${RECORDS_HYDRATED_PAGE_LIMIT_DEFAULT}.`
          );
          return RECORDS_HYDRATED_PAGE_LIMIT_DEFAULT;
        }
        if (parsed > RECORDS_HYDRATED_PAGE_LIMIT_MAX) {
          console.warn(
            `RECORDS_HYDRATED_PAGE_LIMIT ${parsed} exceeds max ${RECORDS_HYDRATED_PAGE_LIMIT_MAX}; clamping.`
          );
          return RECORDS_HYDRATED_PAGE_LIMIT_MAX;
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
      disableMigrateOnStartup: env.DISABLE_MIGRATE_ON_STARTUP,
      startupMigrationLockEnabled: env.STARTUP_MIGRATION_LOCK_ENABLED,
      startupMigrationLockTimeoutMs: env.STARTUP_MIGRATION_LOCK_TIMEOUT_MS,
      rateLimiterWindowMs: env.RATE_LIMITER_WINDOW_MS,
      rateLimiterPerWindow: env.RATE_LIMITER_PER_WINDOW,
      rateLimiterEnabled: env.RATE_LIMITER_ENABLED,
      // Vitest / Jest share one in-memory limiter store across files.
      // Default off under test; individual tests may opt in via mutation.
      exportRateLimiterEnabled: runningUnderTest
        ? false
        : env.EXPORT_RATE_LIMITER_ENABLED,
      exportRateLimiterWindowMs: env.EXPORT_RATE_LIMITER_WINDOW_MS,
      exportRateLimiterPerWindow: env.EXPORT_RATE_LIMITER_PER_WINDOW,
      authAttemptLimiterEnabled: env.ATTEMPT_LIMITER_ENABLED,
      memoryMonitorEnabled: env.MEMORY_MONITOR_ENABLED,
      requestLoggingEnabled: env.REQUEST_LOGGING_ENABLED,
      keySource: env.KEY_SOURCE,
      maximumLongLivedDurationDays: env.MAXIMUM_LONG_LIVED_DURATION_DAYS,
      bugsnagApiKey: env.BUGSNAG_API_KEY,
      jsonBodyLimit: env.JSON_BODY_LIMIT,
      urlencodedBodyLimit: env.URLENCODED_BODY_LIMIT,
      restoreUploadMaxBytes: env.RESTORE_UPLOAD_MAX_BYTES,
      recordsHydratedPageLimit: env.RECORDS_HYDRATED_PAGE_LIMIT,
      localCouchdbAuth,
      conductorInstanceName,
      localLoginEnabled: env.DISABLE_LOCAL_LOGIN,
      runningUnderTest,
      newConductorUrl: env.NEW_CONDUCTOR_URL,
      redirectWhitelist: env.REDIRECT_WHITELIST,
      downloadCookieSameSite: env.DOWNLOAD_COOKIE_SAMESITE,
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
      _attachment: {
        serviceType: env.ATTACHMENT_STORAGE_TYPE,
        bucket: env.ATTACHMENT_S3_BUCKET,
        prefix: env.ATTACHMENT_S3_PREFIX,
        region: env.ATTACHMENT_S3_REGION,
        endpoint: env.ATTACHMENT_S3_ENDPOINT,
        publicEndpoint: env.ATTACHMENT_S3_PUBLIC_ENDPOINT,
        forcePathStyle: env.ATTACHMENT_S3_FORCE_PATH_STYLE,
        accessKeyId: env.ATTACHMENT_S3_ACCESS_KEY_ID,
        secretAccessKey: env.ATTACHMENT_S3_SECRET_ACCESS_KEY,
      },
      _capacity: {
        serviceType: env.CAPACITY_PROVIDER,
        max: env.CAPACITY_MAX,
        scaleThresholds: env.CAPACITY_SCALE_THRESHOLDS,
        reconcileMs: env.CAPACITY_RECONCILE_MS,
        fixedReplicas: env.CAPACITY_FIXED_REPLICAS,
        cluster: env.CAPACITY_ECS_CLUSTER,
        taskDefinition: env.CAPACITY_ECS_WORKER_TASK_DEFINITION,
        taskFamily: env.CAPACITY_ECS_WORKER_TASK_FAMILY,
        containerName: env.CAPACITY_ECS_WORKER_CONTAINER,
        subnets: env.CAPACITY_ECS_SUBNETS,
        securityGroups: env.CAPACITY_ECS_SECURITY_GROUPS,
        assignPublicIp: env.CAPACITY_ECS_ASSIGN_PUBLIC_IP,
        idleExitMs: env.SPATIAL_WORKER_IDLE_EXIT_MS,
        pollMs: env.SPATIAL_WORKER_POLL_MS,
        gdalNumThreads: env.GDAL_NUM_THREADS,
        gdalCacheMaxMb: env.GDAL_CACHEMAX,
        gdalWarpMemoryMb: env.GDAL_WARP_MEMORY_MB,
        gdalWarpMulti: env.GDAL_WARP_MULTI,
        tippecanoeMaxThreads: env.TIPPECANOE_MAX_THREADS,
      },
      _keyFileHost: keyFileHost,
    };
  });

const parsed = EnvSchema.parse(process.env);

const {_email, _attachment, _capacity, _keyFileHost, ...configFields} = parsed;

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

function resolveAttachmentStorageType(): AttachmentStorageType {
  if (configFields.runningUnderTest) {
    console.log('Since we are testing, using mock attachment storage.');
    return AttachmentStorageType.MOCK;
  }
  return _attachment.serviceType;
}

const TEST_ATTACHMENT_STORAGE_CONFIG: AttachmentStorageConfig = {
  bucket: 'test-map-assets',
  prefix: 'map-assets',
  region: 'us-east-1',
};

/** Validates S3 env and throws with a detailed missing-field report if incomplete. */
function resolveAttachmentStorageConfig(): AttachmentStorageConfig {
  const bucket = _attachment.bucket;
  const prefix = _attachment.prefix;
  const region = _attachment.region;
  const endpoint = configHelpers.isBlank(_attachment.endpoint)
    ? undefined
    : _attachment.endpoint;
  const publicEndpoint = configHelpers.isBlank(_attachment.publicEndpoint)
    ? undefined
    : _attachment.publicEndpoint;
  const accessKeyId = configHelpers.isBlank(_attachment.accessKeyId)
    ? undefined
    : _attachment.accessKeyId;
  const secretAccessKey = configHelpers.isBlank(_attachment.secretAccessKey)
    ? undefined
    : _attachment.secretAccessKey;
  const forcePathStyleExplicit = _attachment.forcePathStyle;
  const forcePathStyle =
    forcePathStyleExplicit === undefined
      ? endpoint !== undefined
      : forcePathStyleExplicit.toLowerCase() === 'true';

  const missingConfig = [];
  if (configHelpers.isBlank(bucket)) missingConfig.push('ATTACHMENT_S3_BUCKET');
  if (configHelpers.isBlank(prefix)) missingConfig.push('ATTACHMENT_S3_PREFIX');
  if (configHelpers.isBlank(region)) missingConfig.push('ATTACHMENT_S3_REGION');

  if (missingConfig.length > 0) {
    const providedConfig = {
      ATTACHMENT_S3_BUCKET: bucket || '[missing]',
      ATTACHMENT_S3_PREFIX: prefix || '[missing]',
      ATTACHMENT_S3_REGION: region || '[missing]',
      ATTACHMENT_S3_ENDPOINT: endpoint || '[not set — AWS S3]',
      ATTACHMENT_S3_PUBLIC_ENDPOINT:
        publicEndpoint || '[not set — same as endpoint]',
      ATTACHMENT_S3_FORCE_PATH_STYLE: forcePathStyleExplicit || '[default]',
      ATTACHMENT_S3_ACCESS_KEY_ID: accessKeyId
        ? '[provided]'
        : '[not set — default credential chain]',
      ATTACHMENT_S3_SECRET_ACCESS_KEY: secretAccessKey
        ? '[provided]'
        : '[not set — default credential chain]',
    };

    throw new Error(
      `Attachment storage configuration is incomplete. Missing required values: ${missingConfig.join(', ')}.\n` +
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

const attachmentStorageType = resolveAttachmentStorageType();
const attachmentStorage =
  attachmentStorageType === AttachmentStorageType.S3
    ? resolveAttachmentStorageConfig()
    : TEST_ATTACHMENT_STORAGE_CONFIG;

function splitCsv(value: string | undefined): string[] {
  if (configHelpers.isBlank(value)) {
    return [];
  }
  return value
    .split(',')
    .map(part => part.trim())
    .filter(part => part.length > 0);
}

function resolveCapacityProviderType(): CapacityProviderType {
  if (configFields.runningUnderTest) {
    return CapacityProviderType.MOCK;
  }
  return _capacity.serviceType;
}

/** Validates ECS RunTask env. Only called when the provider type is ECS. */
function resolveEcsCapacityConfig(): EcsCapacityProviderConfig {
  const cluster = _capacity.cluster;
  const taskDefinition = _capacity.taskDefinition;
  const taskFamily = _capacity.taskFamily;
  const containerName = _capacity.containerName;
  const subnets = splitCsv(_capacity.subnets);
  const securityGroups = splitCsv(_capacity.securityGroups);
  const assignRaw = configHelpers.isBlank(_capacity.assignPublicIp)
    ? 'ENABLED'
    : _capacity.assignPublicIp.toUpperCase();

  const missing: string[] = [];
  if (configHelpers.isBlank(cluster)) missing.push('CAPACITY_ECS_CLUSTER');
  if (configHelpers.isBlank(taskDefinition)) {
    missing.push('CAPACITY_ECS_WORKER_TASK_DEFINITION');
  }
  if (configHelpers.isBlank(taskFamily)) {
    missing.push('CAPACITY_ECS_WORKER_TASK_FAMILY');
  }
  if (configHelpers.isBlank(containerName)) {
    missing.push('CAPACITY_ECS_WORKER_CONTAINER');
  }
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

const capacityProviderType = resolveCapacityProviderType();
const capacityEcs =
  capacityProviderType === CapacityProviderType.ECS
    ? resolveEcsCapacityConfig()
    : undefined;

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
  attachmentStorageType,
  attachmentStorage,
  capacityProviderType,
  /** Present when {@link capacityProviderType} is ECS. */
  capacityEcs,
  capacityMax: _capacity.max,
  capacityScaleThresholds: _capacity.scaleThresholds,
  capacityReconcileMs: _capacity.reconcileMs,
  capacityFixedReplicas: _capacity.fixedReplicas,
  spatialWorkerIdleExitMs: _capacity.idleExitMs,
  spatialWorkerPollMs: _capacity.pollMs,
  gdalNumThreads: _capacity.gdalNumThreads,
  gdalCacheMaxMb: _capacity.gdalCacheMaxMb,
  gdalWarpMemoryMb: _capacity.gdalWarpMemoryMb,
  gdalWarpMulti: _capacity.gdalWarpMulti,
  tippecanoeMaxThreads: _capacity.tippecanoeMaxThreads,
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

/** Attachment-storage singleton. Tests may stub methods on this instance. */
export const attachmentStorageService: IAttachmentStorageService =
  createAttachmentStorageService({
    serviceType: attachmentStorageType,
    config: attachmentStorage,
  });
