import * as fs from 'fs';
import * as path from 'path';
import {z} from 'zod';

import {
  AttachmentStorageBuildConfigSchema,
  BuildConfigCoreObjectSchema,
  CapacityScaleThresholdsArraySchema,
  GdalNumThreadsJsonSchema,
  SHARED_DEFAULTS,
  parseBuildConfig,
} from '@faims3/build-config';

// The shared deployment config (bugsnag key, maps/offline maps, address
// autosuggest, theme/notebook branding, support links, security, SMTP, auth
// provider definitions, attachment storage prefix, conductor instance
// name/description/migrate flags) is the same `core.json` every platform
// uses, parsed with build-config's full `parseBuildConfig` (shared
// invariants included — domain endpoint derivation, name fallbacks, clamps).
// Only the AWS-specific config (`aws.json`) remains below. There is
// deliberately no secret *value* handling here: `aws.json` carries Secrets
// Manager ARNs, and secret values move only inside AWS (SM -> ECS task / SM
// -> API process).

export const AttachmentStorageConfigSchema = AttachmentStorageBuildConfigSchema;

const MonitoringConfigSchema = z.object({
  cpu: z
    .object({
      /** Percentage threshold for CPU utilization alarm (0-100) */
      threshold: z.number().min(0).max(100).optional(),
      /** Number of evaluation periods for CPU alarm */
      evaluationPeriods: z.number().int().positive().optional(),
      /** Number of datapoints that must be breaching to trigger CPU alarm */
      datapointsToAlarm: z.number().int().positive().optional(),
    })
    .optional(),
  memory: z
    .object({
      /** Percentage threshold for memory usage alarm (0-100) */
      threshold: z.number().min(0).max(100).optional(),
      /** Number of evaluation periods for memory alarm */
      evaluationPeriods: z.number().int().positive().optional(),
      /** Number of datapoints that must be breaching to trigger memory alarm */
      datapointsToAlarm: z.number().int().positive().optional(),
    })
    .optional(),
  disk: z
    .object({
      /** Percentage threshold for disk usage alarm (0-100) */
      threshold: z.number().min(0).max(100).optional(),
      /** Number of evaluation periods for disk alarm */
      evaluationPeriods: z.number().int().positive().optional(),
      /** Number of datapoints that must be breaching to trigger disk alarm */
      datapointsToAlarm: z.number().int().positive().optional(),
    })
    .optional(),
  statusCheck: z
    .object({
      /** Number of evaluation periods for status check alarm */
      evaluationPeriods: z.number().int().positive().optional(),
      /** Number of datapoints that must be breaching to trigger status check alarm */
      datapointsToAlarm: z.number().int().positive().optional(),
    })
    .optional(),
  networkIn: z
    .object({
      /** Threshold in bytes for network in alarm */
      threshold: z.number().positive().optional(),
      /** Number of evaluation periods for network in alarm */
      evaluationPeriods: z.number().int().positive().optional(),
      /** Number of datapoints that must be breaching to trigger network in alarm */
      datapointsToAlarm: z.number().int().positive().optional(),
    })
    .optional(),
  networkOut: z
    .object({
      /** Threshold in bytes for network out alarm */
      threshold: z.number().positive().optional(),
      /** Number of evaluation periods for network out alarm */
      evaluationPeriods: z.number().int().positive().optional(),
      /** Number of datapoints that must be breaching to trigger network out alarm */
      datapointsToAlarm: z.number().int().positive().optional(),
    })
    .optional(),
  http5xx: z
    .object({
      /** Threshold count for HTTP 5xx errors alarm */
      threshold: z.number().int().nonnegative().optional(),
      /** Number of evaluation periods for HTTP 5xx errors alarm */
      evaluationPeriods: z.number().int().positive().optional(),
      /** Number of datapoints that must be breaching to trigger HTTP 5xx errors alarm */
      datapointsToAlarm: z.number().int().positive().optional(),
    })
    .optional(),
  alarmTopic: z
    .object({
      /** Email address for alarm notifications */
      emailAddress: z.string().email().optional(),
    })
    .optional(),
});

const CouchConfigSchema = z.object({
  /** The size in GB of the volume to mount to EC2 */
  volumeSize: z.number(),
  /** The ID of EBS snapshot to recover from in the root device (optional) */
  ebsRecoverySnapshotId: z.string().optional(),
  /** Monitoring/alarming configuration */
  monitoring: MonitoringConfigSchema.optional(),
  /** EC2 instance type for CouchDB */
  instanceType: z.string(),
  /** The version to use of CouchDB - 3.3.3 is default */
  couchVersionTag: z.string().default('3.3.3'),
});

const DomainsConfigSchema = z.object({
  /** The base domain for all services. Note: Apex domains are not currently supported. */
  baseDomain: z.string(),
  /** The subdomain prefix for the conductor service */
  conductor: z.string().default('conductor'),
  /** The subdomain prefix for the CouchDB service */
  couch: z.string().default('couchdb'),
  /** The subdomain prefix for the main FAIMS application */
  faims: z.string().default('faims'),
  /** New conductor/web deployment subdomain */
  web: z.string().default('web'),
  /** The subdomain prefix for the documentation site (user docs, built with Sphinx) */
  docs: z.string().default('docs'),
});

export const ConductorConfigSchema = z
  .object({
    /** Conductor docker image e.g. org/faims3-api */
    conductorDockerImage: z.string(),
    /** Conductor docker image e.g. latest, sha-123456 */
    conductorDockerImageTag: z.string().default('latest'),
    /** The number of CPU units for the Fargate task */
    cpu: z.number().int().positive(),
    /** The amount of memory (in MiB) for the Fargate task */
    memory: z.number().int().positive(),
    /**
     * Fargate ephemeral storage (GiB) for the API task. Map-layer GDAL
     * scratch lives on the spatial worker task, so the API only needs
     * room to stage an upload before it is copied to S3. AWS allows 21–200.
     */
    ephemeralStorageGiB: z.number().int().min(21).max(200).default(21),
    /** Auto scaling configuration for the Conductor service */
    autoScaling: z.object({
      /** The desired number of tasks to run (general stable target) */
      desiredCapacity: z.number().int().positive(),
      /** The minimum number of tasks to run */
      minCapacity: z.number().int().positive(),
      /** The maximum number of tasks that can be run */
      maxCapacity: z.number().int().positive(),
      /** The target CPU utilization percentage for scaling */
      targetCpuUtilization: z.number().min(0).max(100),
      /** The target memory utilization percentage for scaling */
      targetMemoryUtilization: z.number().min(0).max(100),
      /** The cooldown period (in seconds) before allowing another scale in action */
      scaleInCooldown: z.number().int().nonnegative(),
      /** The cooldown period (in seconds) before allowing another scale out action */
      scaleOutCooldown: z.number().int().nonnegative(),
    }),
    /** Allow localhost typical addresses in the redirects for conductor? NOT
     * recommended for production use cases (for security reasons). */
    localhostWhitelist: z.boolean().default(false),
    /** Enable enhanced cluster observability? See the ECS container-insights docs. */
    enhancedObservability: z.boolean().optional(),
  })
  .strict();

/**
 * AWS-specific social-sign-in provider config. The provider
 * definitions live in `core.authProviders` (build-config's AuthProviderConfigMap).
 * Here we keep only the AWS bits: which providers are enabled for this stack
 * and the Secrets Manager ARN holding their client secrets / private keys.
 */
export const AuthProvidersAwsConfigSchema = z.object({
  /** Provider ids (keys of core.authProviders) enabled for this stack. */
  providers: z.array(z.string()),
  /** ARN of the secret containing the provider client secrets / private keys. */
  secretArn: z.string(),
});

// The shared provider *definitions* are now core.authProviders (build-config).
export type AuthProviderConfigMap = z.infer<
  typeof BuildConfigCoreObjectSchema
>['authProviders'];

// Define the schema for the backup configuration
const BackupConfigSchema = z
  .object({
    /**
     * The name of the backup vault to create or use
     */
    vaultName: z.string().optional(),
    /**
     * The ARN of an existing backup vault to use (optional)
     * If provided, a new vault will not be created
     */
    vaultArn: z.string().optional(),
    /**
     * The number of days to retain backups (default: 30)
     */
    retentionDays: z.number().int().min(1).default(30),
    /**
     * The cron schedule expression to be used for running the backup e.g. cron(...)
     */
    scheduleExpression: z.string().default('cron(0 3 * * ? *)'),
  })
  .refine(
    data => (data.vaultName !== undefined) !== (data.vaultArn !== undefined),
    {
      message: 'Either vaultName or vaultArn must be provided, but not both',
    }
  );

/**
 * Scheduled one-shot ECS task that runs Conductor TTL cleanup against CouchDB.
 * Independent of Conductor service scaling (EventBridge Scheduler → RunTask).
 * See docs/developer/docs/source/markdown/TtlCleanup.md.
 */
const TtlCleanupConfigSchema = z.object({
  /** When false, no schedule / task definition is created. */
  enabled: z.boolean().default(false),
  /**
   * EventBridge Scheduler cron/rate expression. Hours/minutes are interpreted in
   * `scheduleExpressionTimezone` (default Australia/Sydney), not UTC.
   */
  scheduleExpression: z.string().default('cron(0 2 * * ? *)'),
  /**
   * IANA timezone for `scheduleExpression` (EventBridge Scheduler
   * ScheduleExpressionTimezone). Default Australia/Sydney so daily runs stay at
   * local 02:00 through AEST/AEDT.
   */
  scheduleExpressionTimezone: z.string().default('Australia/Sydney'),
  /** Pass --dry-run to the cleanup script (report only). */
  dryRun: z.boolean().default(false),
  /** Pass --compact after successful deletes (prefer rarer cadence). */
  compact: z.boolean().default(false),
  /** Pass --include-longlived for optional long-lived token sweep. */
  includeLongLived: z.boolean().default(false),
  /**
   * Pass --delete-exhausted-invites for non-expired invites with exhausted uses.
   * Default false — exhausted invites may still be useful if uses are raised later.
   */
  deleteExhaustedInvites: z.boolean().default(false),
  /** Fargate CPU units for the cleanup task. */
  cpu: z.number().int().positive().default(256),
  /** Fargate memory (MiB) for the cleanup task. */
  memory: z.number().int().positive().default(512),
});

/**
 * Capacity manager (always-on, desired 1) plus a spatial-worker task
 * definition. The manager starts workers with RunTask; workers exit when
 * idle, so there is no worker ECS service to replace them.
 */
export const SpatialCapacityConfigSchema = z.object({
  /** Max drain workers the manager may start at once. */
  maxCapacity: z.number().int().positive().default(SHARED_DEFAULTS.capacityMax),
  /**
   * Queue depths at which worker count increases from 1.
   * `[3, 8, 16, 32]` means 1→2 at 3 jobs, 2→3 at 8, 3→4 at 16, 4→5 at 32.
   * Always capped by maxCapacity. Passed to the manager as CSV.
   */
  scaleThresholds: CapacityScaleThresholdsArraySchema.default([
    ...SHARED_DEFAULTS.capacityScaleThresholds,
  ]),
  /** How often the manager reads the Couch queue (ms). */
  reconcileMs: z
    .number()
    .int()
    .positive()
    .default(SHARED_DEFAULTS.capacityReconcileMs),
  /**
   * How long the oldest unclaimed job may wait before the manager asks
   * for the first extra worker (still capped by maxCapacity and job
   * count). `0` disables. Default 5 minutes.
   */
  starvationMs: z
    .number()
    .int()
    .nonnegative()
    .default(SHARED_DEFAULTS.capacityStarvationMs),
  /**
   * After the first staleness scale-up, how long the oldest unclaimed
   * job must keep waiting before another extra worker. Omit to use
   * `2 * starvationMs`. `0` keeps only the first extra.
   */
  scaleInCooldownMs: z.number().int().nonnegative().optional(),
  /**
   * Worker exits after this many ms with no job. Must be > 0 on ECS or
   * tasks would run until the next deploy.
   */
  idleExitMs: z
    .number()
    .int()
    .positive()
    .default(SHARED_DEFAULTS.spatialWorkerIdleExitMs),
  /** Fargate CPU units for one spatial worker. */
  cpu: z.number().int().positive().default(1024),
  /** Fargate memory (MiB) for one spatial worker. */
  memory: z.number().int().positive().default(2048),
  /**
   * Worker ephemeral disk (GiB) for the original download plus GDAL scratch.
   * AWS allows 21–200. Default 80.
   */
  ephemeralStorageGiB: z.number().int().min(21).max(200).default(80),
  /** Fargate CPU units for the capacity manager. */
  managerCpu: z.number().int().positive().default(256),
  /** Fargate memory (MiB) for the capacity manager. */
  managerMemory: z.number().int().positive().default(512),
  /**
   * GDAL worker threads (`GDAL_NUM_THREADS`). `ALL_CPUS` uses the task
   * vCPU count. A positive integer caps it. Default `ALL_CPUS`.
   */
  gdalNumThreads: GdalNumThreadsJsonSchema.default(
    SHARED_DEFAULTS.gdalNumThreads
  ),
  /**
   * Raster block cache in megabytes (`GDAL_CACHEMAX`). Default 256 fits
   * the 2 GiB worker. Raise toward 1024–2048 on 16–32 GiB tasks.
   */
  gdalCacheMaxMb: z
    .number()
    .int()
    .positive()
    .max(65536)
    .default(SHARED_DEFAULTS.gdalCacheMaxMb),
  /**
   * `gdalwarp -wm` working buffer in megabytes. Shared across warp
   * threads — raise with `gdalNumThreads`. Default 256.
   */
  gdalWarpMemoryMb: z
    .number()
    .int()
    .positive()
    .max(65536)
    .default(SHARED_DEFAULTS.gdalWarpMemoryMb),
  /** `gdalwarp -multi`: overlap I/O with compute. Default true. */
  gdalWarpMulti: z.boolean().default(SHARED_DEFAULTS.gdalWarpMulti),
  /**
   * Cap tippecanoe threads (`TIPPECANOE_MAX_THREADS`). Omit to use all
   * CPUs (tippecanoe's default).
   */
  tippecanoeMaxThreads: z.number().int().positive().max(256).optional(),
});

/** Defaults shared with Conductor env wiring (`EXPORT_RATE_LIMITER_*`). */
export const DEFAULT_EXPORT_RATE_LIMITER_WINDOW_MS =
  SHARED_DEFAULTS.exportRateLimiterWindowMs;
export const DEFAULT_EXPORT_RATE_LIMITER_PER_WINDOW =
  SHARED_DEFAULTS.exportRateLimiterPerWindow;

/**
 * The AWS-specific extension of the shared core config.
 * Everything genuinely about deploying to AWS: the CloudFormation stack
 * identity, the hosted zone / certificates, account/region, the Secrets
 * Manager key + SMTP-credentials ARNs, the CouchDB EC2/EBS sizing, backups,
 * TTL cleanup, the Conductor Fargate task (docker image, CPU/memory,
 * ephemeral storage, autoscaling, localhost whitelist), the spatial worker
 * Fargate pool, the Route53 subdomain prefixes, and the AWS bits of auth
 * providers (enabled list + secret ARN). The shared deployment config lives
 * in `core`, validated by @faims3/build-config.
 */
export const AwsConfigSchema = z.object({
  /** The name of the stack to deploy to cloudformation. Note that changing
   * this will completely redeploy your application. */
  stackName: z.string(),
  /** Attributes of the hosted zone to use */
  hostedZone: z.object({
    id: z.string(),
    name: z.string(),
  }),
  certificates: z.object({
    /** ARN of the primary SSL/TLS certificate */
    primary: z.string(),
    /** ARN of the CloudFront SSL/TLS certificate */
    cloudfront: z.string(),
  }),
  // AWS Account ID
  account: z.string(),
  // AWS Region
  region: z.string().default('ap-southeast-2'),
  secrets: z.object({
    /**
     * ARN of the signing-key secret. The API fetches it at runtime
     * (KEY_SOURCE=AWS_SM) and expects JSON {rsa_private_key, rsa_public_key}
     * in this one secret — there is no separate public-key secret.
     */
    privateKey: z.string(),
  }),
  /** ARN of the secret containing SMTP credentials (host/port/user/pass). */
  smtpCredentialsSecretArn: z.string(),
  /** CouchDB configuration (EC2/EBS sizing) */
  couch: CouchConfigSchema,
  /** Backup configuration */
  backup: BackupConfigSchema,
  /**
   * Scheduled TTL cleanup of ephemeral auth/invite CouchDB docs.
   * Disabled by default — enable only after the API image includes ttlCleanup.
   */
  ttlCleanup: TtlCleanupConfigSchema.optional().default({
    enabled: false,
    scheduleExpression: 'cron(0 2 * * ? *)',
    scheduleExpressionTimezone: 'Australia/Sydney',
    dryRun: false,
    compact: false,
    includeLongLived: false,
    deleteExhaustedInvites: false,
    cpu: 256,
    memory: 512,
  }),
  /** Conductor service configuration (Fargate/docker/autoscaling) */
  conductor: ConductorConfigSchema,
  /**
   * Spatial worker pool. The capacity manager is a tiny service (desired 1).
   * Workers are a task definition only — RunTask, then idle exit.
   */
  spatialCapacity: SpatialCapacityConfigSchema.optional().default({
    maxCapacity: SHARED_DEFAULTS.capacityMax,
    scaleThresholds: [...SHARED_DEFAULTS.capacityScaleThresholds],
    reconcileMs: SHARED_DEFAULTS.capacityReconcileMs,
    starvationMs: SHARED_DEFAULTS.capacityStarvationMs,
    idleExitMs: SHARED_DEFAULTS.spatialWorkerIdleExitMs,
    cpu: 1024,
    memory: 2048,
    ephemeralStorageGiB: 80,
    managerCpu: 256,
    managerMemory: 512,
    gdalNumThreads: SHARED_DEFAULTS.gdalNumThreads,
    gdalCacheMaxMb: SHARED_DEFAULTS.gdalCacheMaxMb,
    gdalWarpMemoryMb: SHARED_DEFAULTS.gdalWarpMemoryMb,
    gdalWarpMulti: SHARED_DEFAULTS.gdalWarpMulti,
  }),
  /** Domain configuration for all services (Route53 subdomain prefixes) */
  domains: DomainsConfigSchema,
  /** Social sign-in providers: which are enabled + the secret ARN. */
  authProviders: AuthProvidersAwsConfigSchema.optional(),
});

/**
 * The top-level CDK config, composed from the two deployment files:
 * `core` (the shared `core.json`, the same file the app/web/api and mobile
 * builds use) and `aws` (the AWS-only extension in `aws.json`).
 *
 * `core` is first shape-checked with build-config's core object schema
 * (which is composable into this object), then run through the full
 * `parseBuildConfig` in the transform so the shared invariants (domain
 * endpoint derivation, name fallbacks, OSM/token clamps) apply on the AWS
 * path exactly as they do everywhere else. Parsing the core object schema
 * alone would silently skip those derivations.
 */
export const ConfigSchema = z
  .object({
    core: BuildConfigCoreObjectSchema,
    aws: AwsConfigSchema,
  })
  .transform(({core, aws}) => ({core: parseBuildConfig(core), aws}));

// Infer the types from the schemas
export type Config = z.infer<typeof ConfigSchema>;
export type CouchConfig = z.infer<typeof CouchConfigSchema>;
export type BackupConfig = z.infer<typeof BackupConfigSchema>;
export type MonitoringConfig = z.infer<typeof MonitoringConfigSchema>;
export type ConductorConfig = z.infer<typeof ConductorConfigSchema>;
export type TtlCleanupConfig = z.infer<typeof TtlCleanupConfigSchema>;
export type SpatialCapacityConfig = z.infer<typeof SpatialCapacityConfigSchema>;
export type DomainsConfig = z.infer<typeof DomainsConfigSchema>;
export type AuthProvidersConfig = z.infer<typeof AuthProvidersAwsConfigSchema>;
export type AttachmentStorageConfig = z.infer<
  typeof AttachmentStorageConfigSchema
>;

/**
 * Validate a parsed core + aws pair (composing them through ConfigSchema,
 * which runs the core through the full build-config invariants) and apply
 * the cross-file rule: every provider enabled in aws.authProviders must
 * have a definition in core.authProviders.
 */
export function parseConfig(coreRaw: unknown, awsRaw: unknown): Config {
  const config = ConfigSchema.parse({core: coreRaw, aws: awsRaw});
  const enabled = config.aws.authProviders?.providers ?? [];
  const missing = enabled.filter(id => !(id in config.core.authProviders));
  if (missing.length > 0) {
    throw new Error(
      `authProviders.providers lists provider(s) with no core.authProviders entry: ${missing.join(', ')}`
    );
  }
  return config;
}

function readJsonFile(filePath: string): unknown {
  const absolutePath = path.resolve(process.cwd(), filePath);
  return JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));
}

function reportAndThrow(error: unknown): never {
  if (error instanceof z.ZodError) {
    console.error('Configuration validation failed:');
    error.issues.forEach(err => {
      console.error(`- ${err.path.join('.')}: ${err.message}`);
    });
  } else {
    console.error('Error loading configuration:', error);
  }
  process.exitCode = 1;
  throw new Error('Error loading configuration');
}

/**
 * Load the canonical two-file deployment config: `core.json` (shared,
 * parsed by @faims3/build-config) + `aws.json` (AWS extension, ARNs only —
 * no secret values are read or merged on this path; Secrets Manager
 * delivers them to the ECS task / API at runtime).
 */
export const loadConfigFiles = (
  coreFilePath: string,
  awsFilePath: string
): Config => {
  try {
    return parseConfig(readJsonFile(coreFilePath), readJsonFile(awsFilePath));
  } catch (error) {
    return reportAndThrow(error);
  }
};

/**
 * Resolve and load the deployment config from environment variables, in
 * precedence order:
 *  1. CORE_CONFIG_FILE + AWS_CONFIG_FILE (explicit file paths)
 *  2. CONFIG_DIR (a directory containing core.json + aws.json — e.g. an
 *     env folder in a checked-out config repository; read in place, no
 *     copying. This is what CI uses, via the FAIMS Config GitHub Action.)
 *  3. CONFIG_ENV=<name> (the local config mirror written by
 *     scripts/sync-deployment-config.sh at <repo-root>/config/<name>/)
 * There is one config layout everywhere: an env folder holding core.json
 * (shared, non-secret) + aws.json (AWS extension, Secrets Manager ARNs
 * only). The legacy flat and combined single-file formats are gone; migrate
 * old files with library/build-config/scripts/migrate-aws-config.ts.
 * `baseDir` is the aws-cdk package directory (infrastructure/aws-cdk).
 */
export const loadConfigFromEnv = (
  baseDir: string,
  env: NodeJS.ProcessEnv = process.env
): Config => {
  const resolve = (p: string) =>
    path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);

  if (env.CORE_CONFIG_FILE || env.AWS_CONFIG_FILE) {
    if (!env.CORE_CONFIG_FILE || !env.AWS_CONFIG_FILE) {
      throw new Error(
        'CORE_CONFIG_FILE and AWS_CONFIG_FILE must be set together.'
      );
    }
    return loadConfigFiles(
      resolve(env.CORE_CONFIG_FILE),
      resolve(env.AWS_CONFIG_FILE)
    );
  }
  if (env.CONFIG_DIR) {
    const dir = resolve(env.CONFIG_DIR);
    return loadConfigFiles(
      path.join(dir, 'core.json'),
      path.join(dir, 'aws.json')
    );
  }
  if (env.CONFIG_ENV) {
    // Local mirror: <repo-root>/config/<env>/ (baseDir is
    // <repo-root>/infrastructure/aws-cdk), populated by
    // scripts/sync-deployment-config.sh pull <env>.
    const dir = path.resolve(baseDir, '..', '..', 'config', env.CONFIG_ENV);
    return loadConfigFiles(
      path.join(dir, 'core.json'),
      path.join(dir, 'aws.json')
    );
  }
  throw new Error(
    'No deployment config specified. Set CONFIG_ENV=<name> (local mirror config/<name>/ from scripts/sync-deployment-config.sh), CONFIG_DIR=<dir containing core.json + aws.json>, or CORE_CONFIG_FILE + AWS_CONFIG_FILE.'
  );
};
