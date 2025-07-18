import * as fs from 'fs';
import * as path from 'path';
import {z} from 'zod';

/** Configuration for the maps/offline maps */
const OfflineMapsConfigSchema = z.object({
  /** Map source provider ('osm', 'maptiler', or empty string) */
  mapSource: z.enum(['osm', 'maptiler']).default('maptiler'),
  /** API key for the map tile service (e.g., maptiler) */
  mapSourceKey: z.string().optional(),
  /** Enable offline map downloads. Note that some services, notably OSM, don't
   * allow map tile downloads */
  offlineMaps: z.boolean(),
  /** Map style to use. Can be 'basic' (default), 'osm-bright', 'openstreetmap',
   * 'toner' */
  mapStyle: z
    .enum(['basic', 'osm-bright', 'openstreetmap', 'toner'])
    .default('basic'),
});

const SocialProvidersConfigSchema = z.object({
  google: z
    .object({
      secretArn: z.string(),
    })
    .optional(),
});

const SMTPConfigSchema = z.object({
  /** Email service type (SMTP or MOCK) */
  emailServiceType: z.enum(['SMTP']),
  /** From email address */
  fromEmail: z.string().email(),
  /** From name */
  fromName: z.string(),
  /** Reply-to email address (optional) */
  replyTo: z.string().email().optional(),
  /** Test email address for admin verification */
  testEmailAddress: z.string().email(),
  /** Cache expiry in seconds (optional) */
  cacheExpirySeconds: z.number().int().positive().optional(),
  /** ARN of the secret containing SMTP credentials */
  credentialsSecretArn: z.string(),
});

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
});

const ConductorConfigSchema = z.object({
  /** The title for this conductor instance, shown on listings page */
  name: z.string(),
  /** The description shown underneath as a sub heading */
  description: z.string(),
  /** Conductor docker image e.g. org/faims3-api */
  conductorDockerImage: z.string(),
  /** Conductor docker image e.g. latest, sha-123456 */
  conductorDockerImageTag: z.string().default('latest'),
  /** The prefix to use for the short codes in the app */
  shortCodePrefix: z.string().default('FAIMS'),
  /** The number of CPU units for the Fargate task */
  cpu: z.number().int().positive(),
  /** The amount of memory (in MiB) for the Fargate task */
  memory: z.number().int().positive(),
  /** Auto scaling configuration for the Conductor service */
  autoScaling: z.object({
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
});

const WebConfigSchema = z.object({});

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

const AppSupportLinksSchema = z.object({
  /** The support email address */
  supportEmail: z.string().default('support@fieldmark.au'),
  /** The URL for the privacy policy */
  privacyPolicyUrl: z.string().url().default('https://fieldnote.au/privacy'),
  /** The URL for the contact page */
  contactUrl: z.string().url().default(''),
});

export const UiConfiguration = z.object({
  /** The UI Theme for the app */
  uiTheme: z.enum(['bubble', 'default', 'bssTheme']),
  /** The notebook list type for the app */
  notebookListType: z.enum(['tabs', 'headings']),
  /** The display name for notebooks e.g. survey, notebook */
  notebookName: z.string(),
  /** The name of the App in app store etc - heading by default */
  appName: z.string(),
  /** The ID of the App in app store - should be simple acronym/short e.g. FAIMS */
  appId: z.string(),
  /** Override the heading text in banner */
  headingAppName: z.string().optional(),
  /** Offline maps settings */
  offlineMaps: OfflineMapsConfigSchema,
});

export const SecurityConfigSchema = z.object({
  /** Maximum number of days for long lived tokens */
  maximumLongLivedTokenDurationDays: z.number().int().min(1).optional(),
});

// Define the schema
export const ConfigSchema = z.object({
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
  aws: z.object({
    // AWS Account ID
    account: z.string(),
    // AWS Region
    region: z.string().default('ap-southeast-2'),
  }),
  secrets: z.object({
    /** ARN of the private key secret */
    privateKey: z.string(),
    /** ARN of the public key secret */
    publicKey: z.string(),
  }),
  /** UI Configuration values */
  uiConfiguration: UiConfiguration,
  /** The support links for the app */
  supportLinks: AppSupportLinksSchema,
  /** CouchDB configuration */
  couch: CouchConfigSchema,
  /** Backup configuration */
  backup: BackupConfigSchema,
  /** Conductor service configuration */
  conductor: ConductorConfigSchema,
  /** Domain configuration for all services */
  domains: DomainsConfigSchema,
  /** Mobile app URLs */
  mobileApps: z.object({
    /** The public URL for the Android application */
    androidAppPublicUrl: z.string(),
    /** The public URL for the iOS application */
    iosAppPublicUrl: z.string(),
  }),
  /** The new-conductor / web config */
  web: WebConfigSchema,
  /** Email service configuration */
  smtp: SMTPConfigSchema,
  /** Social sign in providers */
  socialProviders: SocialProvidersConfigSchema.optional(),
  /** Security parameters */
  security: SecurityConfigSchema.optional().default({
    maximumLongLivedTokenDurationDays: 90,
  }),
});

// Infer the types from the schemas
export type Config = z.infer<typeof ConfigSchema>;
export type CouchConfig = z.infer<typeof CouchConfigSchema>;
export type BackupConfig = z.infer<typeof BackupConfigSchema>;
export type MonitoringConfig = z.infer<typeof MonitoringConfigSchema>;
export type ConductorConfig = z.infer<typeof ConductorConfigSchema>;
export type DomainsConfig = z.infer<typeof DomainsConfigSchema>;
export type SMTPConfig = z.infer<typeof SMTPConfigSchema>;
export type OfflineMapsConfig = z.infer<typeof OfflineMapsConfigSchema>;

export const loadConfig = (filePath: string): Config => {
  // Parse and validate the config
  try {
    const absolutePath = path.resolve(process.cwd(), filePath);
    const fileContents = fs.readFileSync(absolutePath, 'utf-8');
    const jsonData = JSON.parse(fileContents);
    return ConfigSchema.parse(jsonData);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Configuration validation failed:');
      error.errors.forEach(err => {
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
