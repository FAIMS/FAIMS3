import * as cdk from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as sm from 'aws-cdk-lib/aws-secretsmanager';
import {BackupConstruct} from './components/backups';
import {Construct} from 'constructs';
import {FaimsConductor} from './components/conductor';
import {FaimsFrontEnd} from './components/front-end';
import {FaimsNetworking} from './components/networking';
import {EC2CouchDB} from './components/couch-db';
import {z} from 'zod';
import * as fs from 'fs';
import * as path from 'path';

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
  /** The subdomain prefix for the designer service */
  designer: z.string().default('designer'),
  /** The subdomain prefix for the conductor service */
  conductor: z.string().default('conductor'),
  /** The subdomain prefix for the CouchDB service */
  couch: z.string().default('couchdb'),
  /** The subdomain prefix for the main FAIMS application */
  faims: z.string().default('faims'),
});

const ConductorConfigSchema = z.object({
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
});

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

export const UiConfiguration = z.object({
  /** The UI Theme for the app */
  uiTheme: z.enum(['bubble', 'default']),
  /** The notebook list type for the app */
  notebookListType: z.enum(['tabs', 'headings']),
  /** The display name for notebooks e.g. survey, notebook */
  notebookName: z.string(),
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
});

// Infer the types from the schemas
export type Config = z.infer<typeof ConfigSchema>;
export type CouchConfig = z.infer<typeof CouchConfigSchema>;
export type BackupConfig = z.infer<typeof BackupConfigSchema>;
export type MonitoringConfig = z.infer<typeof MonitoringConfigSchema>;
export type ConductorConfig = z.infer<typeof ConductorConfigSchema>;
export type DomainsConfig = z.infer<typeof DomainsConfigSchema>;

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

/**
 * Properties for the FaimsInfraStack
 */
export interface FaimsInfraStackProps extends cdk.StackProps {
  config: Config;
}

/**
 * Main infrastructure stack for the FAIMS application
 */
export class FaimsInfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FaimsInfraStackProps) {
    super(scope, id, props);

    // Pull out main config
    const config = props.config;

    // DNS SETUP
    // =========

    // Setup the hosted zone for domain definitions
    const hz = route53.HostedZone.fromHostedZoneAttributes(this, 'hz', {
      hostedZoneId: config.hostedZone.id,
      zoneName: config.hostedZone.name,
    });

    // Domain configurations
    const domains = {
      couch: `${config.domains.couch}.${config.domains.baseDomain}`,
      conductor: `${config.domains.conductor}.${config.domains.baseDomain}`,
      faims: `${config.domains.faims}.${config.domains.baseDomain}`,
      designer: `${config.domains.designer}.${config.domains.baseDomain}`,
    };

    // BACKUPS SETUP
    // =============
    if (!(config.backup.vaultArn || config.backup.vaultName)) {
      throw Error(
        'Must provide either an existing Backup vault ARN or a vault name to create.'
      );
    }
    const backups = new BackupConstruct(this, 'backup', config.backup);

    // CERTIFICATES
    // ============

    // Primary certificate for the hosted zone
    const primaryCert = acm.Certificate.fromCertificateArn(
      this,
      'primary-cert',
      config.certificates.primary
    );

    // CloudFront certificate
    const cfnCert = acm.Certificate.fromCertificateArn(
      this,
      'cfn-cert',
      config.certificates.cloudfront
    );

    // NETWORKING
    // ==========

    // Setup networking infrastructure
    const networking = new FaimsNetworking(this, 'networking', {
      certificate: primaryCert,
    });

    // Cookie secret shared between couch and conductor

    // Generate cookie auth secret at deploy time
    const cookieSecret = new sm.Secret(this, 'conductor-cookie-secret', {
      description: 'Contains a randomly generated string used for cookie auth in conductor and couch',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      generateSecretString: {
        includeSpace: false,
        passwordLength: 25,
        excludePunctuation: true,
      },
    });

    // COUCHDB
    // =======

    // Create a single EC2 cluster which runs CouchDB
    const couchDb = new EC2CouchDB(this, 'couch-db', {
      vpc: networking.vpc,
      instanceType: config.couch.instanceType,
      certificate: primaryCert,
      domainName: domains.couch,
      hz: hz,
      sharedBalancer: networking.sharedBalancer,
      dataVolumeSize: config.couch.volumeSize,
      dataVolumeSnapshotId: config.couch.ebsRecoverySnapshotId,
      monitoring: config.couch.monitoring,
      couchVersionTag: config.couch.couchVersionTag,
      cookieSecret: cookieSecret
    });

    // CONDUCTOR
    // =========

    // Deploy the conductor API as a load balanced ECS service
    const conductor = new FaimsConductor(this, 'conductor', {
      vpc: networking.vpc,
      certificate: primaryCert,
      domainName: domains.conductor,
      privateKeySecretArn: config.secrets.privateKey,
      hz: hz,
      couchDbAdminSecret: couchDb.passwordSecret,
      couchDBEndpoint: couchDb.couchEndpoint,
      couchDBPort: couchDb.exposedPort,
      webAppPublicUrl: `https://${domains.faims}`,
      androidAppPublicUrl: config.mobileApps.androidAppPublicUrl,
      iosAppPublicUrl: config.mobileApps.iosAppPublicUrl,
      sharedBalancer: networking.sharedBalancer,
      config: config.conductor,
      cookieSecret: cookieSecret
    });

    // FRONT-END
    // =========

    // Deploy the FAIMS 3 web front-end as a S3 CloudFront static website
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const frontEnd = new FaimsFrontEnd(this, 'frontend', {
      couchDbDomainOnly: domains.couch,
      couchDbPort: couchDb.exposedPort,
      faimsDomainNames: [domains.faims],
      faimsHz: hz,
      faimsUsEast1Certificate: cfnCert,
      designerDomainNames: [domains.designer],
      designerHz: hz,
      designerUsEast1Certificate: cfnCert,
      conductorUrl: conductor.conductorEndpoint,
      uiTheme: config.uiConfiguration.uiTheme,
      notebookListType: config.uiConfiguration.notebookListType,
      notebookName: config.uiConfiguration.notebookName,
    });

    // Backup setup
    backups.registerEbsVolume(couchDb.dataVolume, 'couchDbDataVolume');
  }
}
