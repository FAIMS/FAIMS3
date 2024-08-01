import * as cdk from "aws-cdk-lib";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import { BackupConstruct } from "./components/backups";
import { Construct } from "constructs";
import { FaimsConductor } from "./components/conductor";
import { FaimsFrontEnd } from "./components/front-end";
import { FaimsNetworking } from "./components/networking";
import { EC2CouchDB } from "./components/couch-db";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

const MonitoringConfigSchema = z.object({
  cpu: z.object({
    /** Percentage threshold for CPU utilization alarm (0-100) */
    threshold: z.number().min(0).max(100).optional(),
    /** Number of evaluation periods for CPU alarm */
    evaluationPeriods: z.number().int().positive().optional(),
    /** Number of datapoints that must be breaching to trigger CPU alarm */
    datapointsToAlarm: z.number().int().positive().optional(),
  }).optional(),
  memory: z.object({
    /** Percentage threshold for memory usage alarm (0-100) */
    threshold: z.number().min(0).max(100).optional(),
    /** Number of evaluation periods for memory alarm */
    evaluationPeriods: z.number().int().positive().optional(),
    /** Number of datapoints that must be breaching to trigger memory alarm */
    datapointsToAlarm: z.number().int().positive().optional(),
  }).optional(),
  disk: z.object({
    /** Percentage threshold for disk usage alarm (0-100) */
    threshold: z.number().min(0).max(100).optional(),
    /** Number of evaluation periods for disk alarm */
    evaluationPeriods: z.number().int().positive().optional(),
    /** Number of datapoints that must be breaching to trigger disk alarm */
    datapointsToAlarm: z.number().int().positive().optional(),
  }).optional(),
  statusCheck: z.object({
    /** Number of evaluation periods for status check alarm */
    evaluationPeriods: z.number().int().positive().optional(),
    /** Number of datapoints that must be breaching to trigger status check alarm */
    datapointsToAlarm: z.number().int().positive().optional(),
  }).optional(),
  networkIn: z.object({
    /** Threshold in bytes for network in alarm */
    threshold: z.number().positive().optional(),
    /** Number of evaluation periods for network in alarm */
    evaluationPeriods: z.number().int().positive().optional(),
    /** Number of datapoints that must be breaching to trigger network in alarm */
    datapointsToAlarm: z.number().int().positive().optional(),
  }).optional(),
  networkOut: z.object({
    /** Threshold in bytes for network out alarm */
    threshold: z.number().positive().optional(),
    /** Number of evaluation periods for network out alarm */
    evaluationPeriods: z.number().int().positive().optional(),
    /** Number of datapoints that must be breaching to trigger network out alarm */
    datapointsToAlarm: z.number().int().positive().optional(),
  }).optional(),
  http5xx: z.object({
    /** Threshold count for HTTP 5xx errors alarm */
    threshold: z.number().int().nonnegative().optional(),
    /** Number of evaluation periods for HTTP 5xx errors alarm */
    evaluationPeriods: z.number().int().positive().optional(),
    /** Number of datapoints that must be breaching to trigger HTTP 5xx errors alarm */
    datapointsToAlarm: z.number().int().positive().optional(),
  }).optional(),
  alarmTopic: z.object({
    /** Email address for alarm notifications */
    emailAddress: z.string().email().optional(),
  }).optional(),
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
    scheduleExpression: z.string().default("cron(0 3 * * ? *)"),
  })
  .refine(
    (data) => (data.vaultName !== undefined) !== (data.vaultArn !== undefined),
    {
      message: "Either vaultName or vaultArn must be provided, but not both",
    }
  );

// Define the schema
const ConfigSchema = z.object({
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
    region: z.string().default("ap-southeast-2"),
  }),
  secrets: z.object({
    /** ARN of the private key secret */
    privateKey: z.string(),
    /** ARN of the public key secret */
    publicKey: z.string(),
  }),
  couch: z.object({
    /** The size in GB of the volume to mount to EC2 */
    volumeSize: z.number(),
    /** The ID of EBS snapshot to recover from in the root device (optional) */
    ebsRecoverySnapshotId: z.string().optional(),
    /** Monitoring/alarming configuration */
    monitoring: MonitoringConfigSchema.optional(),
  }),
  backup: BackupConfigSchema,
});

// Infer the type from the schemas
export type Config = z.infer<typeof ConfigSchema>;
export type BackupConfig = z.infer<typeof BackupConfigSchema>;
export type MonitoringConfig = z.infer<typeof MonitoringConfigSchema>;

export const loadConfig = (filePath: string): Config => {
  // Parse and validate the config
  try {
    const absolutePath = path.resolve(process.cwd(), filePath);
    const fileContents = fs.readFileSync(absolutePath, "utf-8");
    const jsonData = JSON.parse(fileContents);
    return ConfigSchema.parse(jsonData);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Configuration validation failed:");
      error.errors.forEach((err) => {
        console.error(`- ${err.path.join(".")}: ${err.message}`);
      });
    } else {
      console.error("Error loading configuration:", error);
    }
  }
  process.exit(1);
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
    const hz = route53.HostedZone.fromHostedZoneAttributes(this, "hz", {
      hostedZoneId: config.hostedZone.id,
      zoneName: config.hostedZone.name,
    });

    // Domain configurations
    // TODO: Parameterize these domain configurations
    const rootDomain = hz.zoneName;
    const domains = {
      couch: `couchdb.${rootDomain}`,
      conductor: `conductor.${rootDomain}`,
      web: `faims.${rootDomain}`,
      designer: `designer.${rootDomain}`,
    };

    // BACKUPS SETUP
    // =============
    if (!(config.backup.vaultArn || config.backup.vaultName)) {
      throw Error(
        "Must provide either an existing Backup vault ARN or a vault name to create."
      );
    }
    const backups = new BackupConstruct(this, "backup", config.backup);

    // CERTIFICATES
    // ============

    // Primary certificate for the hosted zone
    const primaryCert = acm.Certificate.fromCertificateArn(
      this,
      "primary-cert",
      config.certificates.primary
    );

    // CloudFront certificate
    const cfnCert = acm.Certificate.fromCertificateArn(
      this,
      "cfn-cert",
      config.certificates.cloudfront
    );

    // NETWORKING
    // ==========

    // Setup networking infrastructure
    const networking = new FaimsNetworking(this, "networking", {
      certificate: primaryCert,
    });

    // COUCHDB
    // =======

    // Create a single EC2 cluster which runs CouchDB
    // TODO: Investigate better key setup process for one-click deploy
    const couchDb = new EC2CouchDB(this, "couch-db", {
      vpc: networking.vpc,
      certificate: primaryCert,
      domainName: domains.couch,
      hz: hz,
      sharedBalancer: networking.sharedBalancer,
      dataVolumeSize: config.couch.volumeSize,
      dataVolumeSnapshotId: config.couch.ebsRecoverySnapshotId,
      monitoring: config.couch.monitoring
    });

    // CONDUCTOR
    // =========

    // Deploy the conductor API as a load balanced ECS service
    const conductor = new FaimsConductor(this, "conductor", {
      vpc: networking.vpc,
      cpu: 1024, // 1 vCPU
      memory: 2048, // 2 GB RAM
      certificate: primaryCert,
      domainName: domains.conductor,
      privateKeySecretArn: config.secrets.privateKey,
      hz: hz,
      couchDbAdminSecret: couchDb.passwordSecret,
      couchDBEndpoint: couchDb.couchEndpoint,
      couchDBPort: couchDb.exposedPort,
      webAppPublicUrl: `https://${domains.web}`,
      androidAppPublicUrl: "https://fake.com", // TODO: Update with real URL
      iosAppPublicUrl: "https://fake.com", // TODO: Update with real URL
      sharedBalancer: networking.sharedBalancer,
    });

    // FRONT-END
    // =========

    // Deploy the FAIMS 3 web front-end as a S3 CloudFront static website
    const frontEnd = new FaimsFrontEnd(this, "frontend", {
      couchDbDomainOnly: domains.couch,
      couchDbPort: couchDb.exposedPort,
      faimsDomainNames: [domains.web],
      faimsHz: hz,
      faimsUsEast1Certificate: cfnCert,
      designerDomainNames: [domains.designer],
      designerHz: hz,
      designerUsEast1Certificate: cfnCert,
      conductorUrl: conductor.conductorEndpoint,
    });

    // Backup setup
    backups.registerEbsVolume(couchDb.dataVolume, "couchDbDataVolume");
  }
}
