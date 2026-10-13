import * as fs from 'fs';
import * as path from 'path';
import {z} from 'zod';

import {BuildConfigCoreObjectSchema} from '@faims3/build-config';

// The shared deployment config (bugsnag key, maps/offline maps, address
// autosuggest, theme/notebook branding, support links, security, SMTP, auth
// provider definitions, conductor instance name/description/migrate flags) is
// validated verbatim by @faims3/build-config's BuildConfigCoreObjectSchema in
// the `core` slot (ADR-0002 §1). Only the AWS-specific config remains below.

// For each provider we should have these secrets in the secrets manager
// const AuthProviderSecretSchema = z.object({
//   clientID: z.string(),
//   clientSecret: z.string(),
// });

// The auth provider *definitions* (google/oidc/saml config objects) are now
// validated by @faims3/build-config's AuthProviderConfigMap in core.authProviders
// (ADR-0002 §1). The AWS-specific parts (which providers are enabled + the
// Secrets Manager ARN) are in AuthProvidersAwsConfigSchema above.

// SMTP general config (emailServiceType, from/reply-to, etc.) is now
// core.email (build-config). The AWS-only SMTP credentials secret ARN is in
// the aws slot below (aws.smtpCredentialsSecretArn).

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

/** Age of a still-running lock after which a waiter steals it and runs migrate. */
export const DEFAULT_STARTUP_MIGRATION_LOCK_TIMEOUT_MS = 1_800_000;

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
 * AWS-specific social-sign-in provider config (ADR-0002 §1). The provider
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

// web.title (management website title) is now core.branding.websiteTitle; the
// docs site has no config (core has no docs group).

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

// support links (supportEmail/privacyPolicy/contactUrl/docsUrl) are now
// core.support, and the theme/notebook/app/branding + offline-maps + autosuggest
// + force-remote-deletion / delete-on-deactivation / excluded-team-roles /
// enable-plans / status-tab UI settings are now in core (build-config's
// branding / notebookAndRecordUX / maps / sync / teamAndRolePolicy /
// webDesignerLimits groups). The bubble theme is retired (ADR-0002 §4).

/** Defaults shared with Conductor env wiring (`EXPORT_RATE_LIMITER_*`). */
export const DEFAULT_EXPORT_RATE_LIMITER_WINDOW_MS = 600_000;
export const DEFAULT_EXPORT_RATE_LIMITER_PER_WINDOW = 20;

// Security parameters (max long-lived token duration, HTTP rate limiter,
// attempt limiter, export rate limiter) are now core (build-config's limits
// + authTokens groups).

/**
 * The AWS-specific extension of the shared core config (ADR-0002 §1).
 * Everything genuinely about deploying to AWS: the CloudFormation stack
 * identity, the hosted zone / certificates, account/region, the Secrets
 * Manager key + SMTP-credentials ARNs, the CouchDB EC2/EBS sizing, backups,
 * TTL cleanup, the Conductor Fargate task (docker image, CPU/memory,
 * autoscaling, localhost whitelist), the Route53 subdomain prefixes, and the
 * AWS bits of auth providers (enabled list + secret ARN). The shared
 * deployment config lives in `core`, validated by @faims3/build-config.
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
    /** ARN of the private key secret */
    privateKey: z.string(),
    /** ARN of the public key secret */
    publicKey: z.string(),
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
  /** Domain configuration for all services (Route53 subdomain prefixes) */
  domains: DomainsConfigSchema,
  /** Social sign-in providers: which are enabled + the secret ARN. */
  authProviders: AuthProvidersAwsConfigSchema.optional(),
});

/**
 * The top-level CDK config: `{ core, aws }` (ADR-0002 §1). `core` is validated
 * verbatim by @faims3/build-config (the same schema the app/web/api and the
 * mobile build use), so the shared config is guaranteed identical across all
 * consumers; `aws` is the AWS-specific extension above.
 */
export const ConfigSchema = z.object({
  core: BuildConfigCoreObjectSchema,
  aws: AwsConfigSchema,
});

// Infer the types from the schemas
export type Config = z.infer<typeof ConfigSchema>;
export type CouchConfig = z.infer<typeof CouchConfigSchema>;
export type BackupConfig = z.infer<typeof BackupConfigSchema>;
export type MonitoringConfig = z.infer<typeof MonitoringConfigSchema>;
export type ConductorConfig = z.infer<typeof ConductorConfigSchema>;
export type TtlCleanupConfig = z.infer<typeof TtlCleanupConfigSchema>;
export type DomainsConfig = z.infer<typeof DomainsConfigSchema>;
export type AuthProvidersConfig = z.infer<typeof AuthProvidersAwsConfigSchema>;

export const loadConfig = (filePath: string): Config => {
  // Parse and validate the config
  try {
    const absolutePath = path.resolve(process.cwd(), filePath);
    const fileContents = fs.readFileSync(absolutePath, 'utf-8');
    const jsonData = JSON.parse(fileContents);
    const config = ConfigSchema.parse(jsonData);
    // Cross-slot rule (ADR-0002 §1): every provider enabled in aws.authProviders
    // must have a definition in core.authProviders.
    const enabled = config.aws.authProviders?.providers ?? [];
    const missing = enabled.filter(id => !(id in config.core.authProviders));
    if (missing.length > 0) {
      throw new Error(
        `authProviders.providers lists provider(s) with no core.authProviders entry: ${missing.join(', ')}`
      );
    }
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Configuration validation failed:');
      error.issues.forEach(err => {
        console.error(`- ${err.path.join('.')}: ${err.message}`);
      });
    } else {
      console.error('Error loading configuration:', error);
    }
  }
  //process.exit(1);
  process.exitCode = 1;
  throw new Error('Error loading configuration');
};
