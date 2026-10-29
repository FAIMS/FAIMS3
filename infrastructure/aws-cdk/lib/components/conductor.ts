/*
 * Created Date: Thursday July 25th 2024
 * Author: Peter Baker
 * -----
 * Last Modified: Thursday July 25th 2024 9:36:03 am
 * Modified By: Peter Baker
 * -----
 * Description: Uses shared ALB with http -> https redirect to host ECS cluster for conductor.
 * -----
 * HISTORY:
 * Date      	By	Comments
 * ----------	---	---------------------------------------------------------
 *
 * 25-07-2024 | Peter Baker | use the same LB as the couch DB network to save $$$.
 */

import {Duration, Stack} from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elb from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as r53 from 'aws-cdk-lib/aws-route53';
import * as r53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sm from 'aws-cdk-lib/aws-secretsmanager';
import {Construct} from 'constructs';
import {getPathToRoot} from '../util/mono';
import {SharedBalancer} from './networking';
import {
  authProviderEnvKey,
  buildStringEnvMapFromRuntime,
  providerIdToEnvProvider,
  type AuthProviderConfigInput,
  type RuntimeConfig,
} from '@faims3/build-config';
import {AuthProvidersConfig, ConductorConfig} from '../config';

/** SM fields every enabled provider of this type must have. */
const AUTH_SECRET_FIELDS: Record<string, string[]> = {
  saml: ['privateKey', 'publicKey'],
  google: ['clientID', 'clientSecret'],
  oidc: ['clientID', 'clientSecret'],
};

function coreHasIdpPublicKey(config: AuthProviderConfigInput): boolean {
  return config.type === 'saml' && Boolean(config.idpPublicKey?.trim());
}

/**
 * Secrets Manager JSON fields to inject as `AUTH_{PROVIDER}_{FIELD}`.
 *
 * SAML `idpPublicKey` is optional here: when `core.authProviders` already
 * has the IdP cert, it stays in plain env. When it is omitted, the CDK
 * wires `<provider>-idpPublicKey` from SM so a secrets-only cert still
 * reaches Conductor.
 */
export function authSecretFieldsForProvider(
  config: AuthProviderConfigInput
): string[] {
  const required = AUTH_SECRET_FIELDS[config.type] ?? [];
  if (config.type === 'saml' && !coreHasIdpPublicKey(config)) {
    return [...required, 'idpPublicKey'];
  }
  return [...required];
}

/** AUTH_{PROVIDER}_{FIELD} key used for Secrets Manager wiring and env drops. */
export const authSecretEnvKey = authProviderEnvKey;

export interface ConductorRuntimeEnvInput {
  coreConfig: RuntimeConfig;
  conductorEndpoint: string;
  webAppPublicUrl: string;
  webUrl: string;
  appId: string;
  couchDBEndpoint: string;
  couchDBPort: number;
  conductorExternalPort: number;
  conductorInternalPort: number;
  privateKeySecretArn: string;
  localhostWhitelist: boolean;
  /** Provider ids enabled in aws.authProviders.providers. */
  enabledAuthProviders: string[];
  /** Plain-env keys that ECS will deliver via Secrets Manager instead. */
  secretEnvKeys: string[];
  /** Private S3 bucket name for map-layer objects. */
  mapAssetBucketName?: string;
  /** Key prefix inside the map-layer bucket (defaults to core.attachmentStorage.prefix). */
  mapAssetPrefix?: string;
  /** AWS region for the map-layer bucket. */
  awsRegion?: string;
}

const SPATIAL_WORKER_AND_CAPACITY_ENV_KEYS = [
  'CAPACITY_PROVIDER',
  'CAPACITY_MAX',
  'CAPACITY_SCALE_THRESHOLDS',
  'CAPACITY_RECONCILE_MS',
  'CAPACITY_STARVATION_MS',
  'CAPACITY_SCALE_IN_COOLDOWN_MS',
  'CAPACITY_FIXED_REPLICAS',
  'SPATIAL_WORKER_IDLE_EXIT_MS',
  'SPATIAL_WORKER_POLL_MS',
  'GDAL_NUM_THREADS',
  'GDAL_CACHEMAX',
  'GDAL_WARP_MEMORY_MB',
  'GDAL_WARP_MULTI',
  'TIPPECANOE_MAX_THREADS',
] as const;

/**
 * Build the Conductor container's non-secret environment: the shared API
 * contract, AWS-resolved URL/port/S3 overlays, enabled-provider AUTH_* fields,
 * and no keys that also appear in `secrets`.
 */
export function buildConductorRuntimeEnv(
  input: ConductorRuntimeEnvInput
): Record<string, string> {
  const env = buildStringEnvMapFromRuntime(input.coreConfig, 'api');

  env.PROFILE_NAME = 'default';
  env.KEY_SOURCE = 'AWS_SM';
  env.AWS_SECRET_KEY_ARN = input.privateKeySecretArn;
  // Clustered ECS: default the Couch-mediated lock on so replicas
  // claim/wait. Honour an explicit core.migration.startupMigrationLockEnabled
  // false (single-task / debug). Skip-migrate leaves nothing to lock.
  env.STARTUP_MIGRATION_LOCK_ENABLED =
    input.coreConfig.migration.disableMigrateOnStartup ||
    input.coreConfig.migration.startupMigrationLockEnabled === false
      ? 'false'
      : 'true';
  env.COUCHDB_PUBLIC_URL = input.couchDBEndpoint;
  env.COUCHDB_INTERNAL_URL = input.couchDBEndpoint;
  env.COUCHDB_EXTERNAL_PORT = String(input.couchDBPort);
  env.CONDUCTOR_EXTERNAL_PORT = String(input.conductorExternalPort);
  env.CONDUCTOR_INTERNAL_PORT = String(input.conductorInternalPort);
  env.CONDUCTOR_PUBLIC_URL = input.conductorEndpoint;
  env.CONDUCTOR_URL = input.conductorEndpoint;
  env.WEB_APP_PUBLIC_URL = input.webAppPublicUrl;
  env.REDIRECT_WHITELIST = [
    input.conductorEndpoint,
    input.webAppPublicUrl,
    input.webUrl,
    `${input.appId}://`,
    ...(input.localhostWhitelist
      ? [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:8080',
          'http://localhost:8000',
        ]
      : []),
  ].join(',');

  // Map-layer object storage: on AWS ECS, the bucket/region come from CDK and
  // credentials come from the task role (never local endpoints or static keys).
  env.ATTACHMENT_STORAGE_TYPE = 'S3';
  if (input.mapAssetBucketName !== undefined) {
    env.ATTACHMENT_S3_BUCKET = input.mapAssetBucketName;
  }
  env.ATTACHMENT_S3_PREFIX =
    input.mapAssetPrefix ?? input.coreConfig.attachmentStorage.prefix;
  if (input.awsRegion !== undefined) {
    env.ATTACHMENT_S3_REGION = input.awsRegion;
  }
  delete env.ATTACHMENT_S3_ENDPOINT;
  delete env.ATTACHMENT_S3_PUBLIC_ENDPOINT;
  delete env.ATTACHMENT_S3_FORCE_PATH_STYLE;
  delete env.ATTACHMENT_S3_ACCESS_KEY_ID;
  delete env.ATTACHMENT_S3_SECRET_ACCESS_KEY;

  // Spatial worker and capacity manager env are wired onto their own task
  // definitions by FaimsSpatialCapacity from aws.spatialCapacity.
  for (const key of SPATIAL_WORKER_AND_CAPACITY_ENV_KEYS) {
    delete env[key];
  }

  const enabled = new Set(
    input.enabledAuthProviders.map(providerIdToEnvProvider)
  );
  for (const key of Object.keys(env)) {
    const match = /^AUTH_([A-Z0-9]+)_/.exec(key);
    if (match && !enabled.has(match[1])) {
      delete env[key];
    }
  }

  for (const key of input.secretEnvKeys) {
    delete env[key];
  }
  return env;
}

/**
 * Properties for the FaimsConductor construct
 */
export interface FaimsConductorProps {
  /** VPC to produce ECS cluster in */
  vpc: ec2.IVpc;
  /** Shared balancer to use */
  sharedBalancer: SharedBalancer;
  /** Full domain name for service e.g. website.com */
  domainName: string;
  /** The ARN to secret containing pub/private key in AWS secret manager */
  privateKeySecretArn: string;
  /** The Hosted Zone to produce record in */
  hz: r53.IHostedZone;
  /** The DNS certificate to use for Load Balancer */
  certificate: acm.ICertificate;
  /** CouchDB admin user/password secret */
  couchDbAdminSecret: sm.Secret;
  /** CouchDB port (external) */
  couchDBPort: number;
  /** CouchDB endpoint (format: https://domain:port) */
  couchDBEndpoint: string;
  /** Public URL for the /web (new conductor) */
  webUrl: string;
  /** Public URL for web app */
  webAppPublicUrl: string;
  /** iOS/Android APP_ID */
  appId: string;
  /** The configuration object for the Conductor service (AWS-only: docker/
   * CPU/memory/autoscaling). */
  config: ConductorConfig;
  /** The shared core config - the shared API env (branding, limits, migration,
   * email, token expiries, etc.) is generated from here via
   * buildEnvMapFromRuntime(core, 'api'). */
  coreConfig: RuntimeConfig;
  /** FAIMS_COOKIE_SECRET */
  cookieSecret: sm.Secret;
  /** SMTP credentials secret ARN */
  smtpCredsArn: string;
  /** Private bucket for map-layer originals and normalized files. */
  mapAssetBucket: s3.IBucket;
  /** Key prefix inside {@link mapAssetBucket} (defaults to core.attachmentStorage.prefix). */
  mapAssetPrefix?: string;
  /** Social providers info (if enabled) */
  authProviders?: AuthProvidersConfig;
  /** If true, adds typical localhost addresses to the allowable redirect
   * whitelist (DEV ONLY) */
  localhostWhitelist: boolean;
}

/**
 * Construct for the FAIMS Conductor service
 */
export class FaimsConductor extends Construct {
  /** Internal port for the Conductor service */
  public readonly internalPort: number = 8000;
  /** External HTTPS port */
  public readonly externalPort: number = 443;
  /** Endpoint for Conductor access (format: https://domain:port) */
  public readonly conductorEndpoint: string;
  /** The Fargate Service */
  public readonly fargateService: ecs.FargateService;
  /** ECS cluster hosting the Conductor service (and scheduled one-shot tasks). */
  public readonly cluster: ecs.Cluster;
  /** Security group attached to Conductor tasks (Couch egress equivalent). */
  public readonly serviceSecurityGroup: ec2.SecurityGroup;
  /** Conductor container image (shared with scheduled jobs such as TTL cleanup). */
  public readonly containerImage: ecs.ContainerImage;
  /** Non-secret environment variables applied to the Conductor container. */
  public readonly environment: Record<string, string>;
  /** Secrets Manager-backed secrets applied to the Conductor container. */
  public readonly secrets: Record<string, ecs.Secret>;

  constructor(scope: Construct, id: string, props: FaimsConductorProps) {
    super(scope, id);

    // OUTPUTS
    // ================

    // Build the public URL and expose
    this.conductorEndpoint = `https://${props.domainName}:${this.externalPort}`;

    // CONTAINER SETUP
    // ================

    // If you want to use a local build for debugging (not recommended for production, set this to false)
    const useDockerHub = true;

    if (useDockerHub) {
      // Setup container image from DockerHub image
      this.containerImage = ecs.ContainerImage.fromRegistry(
        `${props.config.conductorDockerImage}:${props.config.conductorDockerImageTag}`
      );
    } else {
      // Build and bundle with cdk and ECR
      this.containerImage = ecs.ContainerImage.fromAsset(getPathToRoot(), {
        file: 'Dockerfile.build',
        exclude: ['infrastructure'],
      });
    }

    // Create the Fargate task definition
    const conductorTaskDfn = new ecs.FargateTaskDefinition(
      this,
      'conductor-task-dfn',
      {
        ephemeralStorageGiB: props.config.ephemeralStorageGiB,
        cpu: props.config.cpu,
        memoryLimitMiB: props.config.memory,
      }
    );
    props.mapAssetBucket.grantReadWrite(conductorTaskDfn.taskRole);

    // Add container to the task definition
    const smtpSecret = sm.Secret.fromSecretCompleteArn(
      this,
      'SMTPSecret',
      props.smtpCredsArn
    );

    // Configure auth providers
    // Based on the configuration we generate Secrets Manager references for
    // each enabled provider. Non-secret AUTH_* fields come from
    // buildAuthProviderEnvMap via buildConductorRuntimeEnv.
    const authSecrets: Record<string, ecs.Secret> = {};
    if (props.authProviders && props.authProviders.providers.length > 0) {
      const authSecret = sm.Secret.fromSecretCompleteArn(
        this,
        'AuthSecret',
        props.authProviders.secretArn
      );
      props.authProviders.providers.forEach(provider => {
        // Provider *definitions* live in core.authProviders. Client
        // credentials and SP keys are delivered by Secrets Manager (SM ->
        // container, never through CDK synth or plain env). SAML
        // idpPublicKey may already be in core; if it is not, it is wired
        // from SM the same way.
        const config = props.coreConfig.authProviders[provider];

        // Wire this provider's Secrets Manager references FIRST...
        for (const field of authSecretFieldsForProvider(config)) {
          authSecrets[authSecretEnvKey(provider, field)] =
            ecs.Secret.fromSecretsManager(authSecret, `${provider}-${field}`);
        }

        // ...then guard that every secret field the API needs is covered by
        // THIS provider's own SM reference (checked after wiring, and keyed
        // exactly, so a previous provider's fields can never satisfy it).
        const required = AUTH_SECRET_FIELDS[config.type] ?? [];
        const missing = required.filter(
          field => !(authSecretEnvKey(provider, field) in authSecrets)
        );
        if (missing.length > 0) {
          throw new Error(
            `Auth provider '${provider}' (${config.type}) is missing required secret field(s): ${missing.join(', ')}. Add them to the Secrets Manager secret at aws.authProviders.secretArn (keys '<provider>-<field>'), or disable the provider in aws.authProviders.providers.`
          );
        }
      });
    }

    this.secrets = {
      COUCHDB_PASSWORD: ecs.Secret.fromSecretsManager(
        props.couchDbAdminSecret,
        'password'
      ),
      COUCHDB_USER: ecs.Secret.fromSecretsManager(
        props.couchDbAdminSecret,
        'username'
      ),
      FAIMS_COOKIE_SECRET: ecs.Secret.fromSecretsManager(props.cookieSecret),

      // SMTP Credentials from Secret
      SMTP_HOST: ecs.Secret.fromSecretsManager(smtpSecret, 'host'),
      SMTP_PORT: ecs.Secret.fromSecretsManager(smtpSecret, 'port'),
      SMTP_SECURE: ecs.Secret.fromSecretsManager(smtpSecret, 'secure'),
      SMTP_USER: ecs.Secret.fromSecretsManager(smtpSecret, 'user'),
      SMTP_PASSWORD: ecs.Secret.fromSecretsManager(smtpSecret, 'pass'),

      // Include any auth config secrets
      ...authSecrets,
    };

    // Expose env/secrets so sibling one-shot tasks (e.g. TTL cleanup) can reuse
    // the same Couch + KEY_SOURCE bootstrapping without duplicating the block.
    //
    // The shared API env comes from build-config's apiContract via
    // buildEnvMapFromRuntime (including AUTH_* from buildAuthProviderEnvMap).
    // Only AWS-resolved endpoints/ports, KEY_SOURCE/SM ARN, PROFILE_NAME,
    // map-layer bucket/region, the redirect whitelist, the enabled-provider
    // filter, and SM-key deletions are overlaid here.
    this.environment = buildConductorRuntimeEnv({
      coreConfig: props.coreConfig,
      conductorEndpoint: this.conductorEndpoint,
      webAppPublicUrl: props.webAppPublicUrl,
      webUrl: props.webUrl,
      appId: props.appId,
      couchDBEndpoint: props.couchDBEndpoint,
      couchDBPort: props.couchDBPort,
      conductorExternalPort: this.externalPort,
      conductorInternalPort: this.internalPort,
      privateKeySecretArn: props.privateKeySecretArn,
      localhostWhitelist: props.localhostWhitelist,
      enabledAuthProviders: props.authProviders?.providers ?? [],
      secretEnvKeys: Object.keys(this.secrets),
      mapAssetBucketName: props.mapAssetBucket.bucketName,
      mapAssetPrefix:
        props.mapAssetPrefix ?? props.coreConfig.attachmentStorage.prefix,
      awsRegion: Stack.of(this).region,
    });

    conductorTaskDfn.addContainer('conductor-container-dfn', {
      image: this.containerImage,
      portMappings: [
        {
          containerPort: this.internalPort,
          appProtocol: ecs.AppProtocol.http,
          name: 'conductor-port',
        },
      ],
      environment: this.environment,
      secrets: this.secrets,
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: 'faims-conductor',
        logRetention: logs.RetentionDays.ONE_MONTH,
      }),
    });

    // CLUSTER AND SERVICE SETUP
    // =========================

    // Create the ECS Cluster
    this.cluster = new ecs.Cluster(this, 'ConductorCluster', {
      vpc: props.vpc,
      // Enable enhanced metrics - this gives container/task level insights and
      // more metrics
      ...(props.config.enhancedObservability
        ? {
            containerInsightsV2: ecs.ContainerInsights.ENHANCED,
          }
        : {}),
    });

    // Create Security Group for the Fargate service
    this.serviceSecurityGroup = new ec2.SecurityGroup(
      this,
      'ConductorServiceSG',
      {
        vpc: props.vpc,
        allowAllOutbound: true,
        description: 'Security group for Conductor Fargate service',
      }
    );

    // Create Fargate Service
    this.fargateService = new ecs.FargateService(this, 'conductor-service', {
      cluster: this.cluster,
      taskDefinition: conductorTaskDfn,
      // Target number of tasks to run
      desiredCount: props.config.autoScaling.desiredCapacity,
      securityGroups: [this.serviceSecurityGroup],
      assignPublicIp: true, // TODO Change this if using private subnets with NAT
      // Keep full healthy capacity during deployments (ALB-backed API).
      // With maxHealthyPercent defaulting to 200, ECS starts replacement
      // tasks before draining old ones.
      minHealthyPercent: 100,
      // Cover Node import → /up bind only. Migrate happens after listen.
      healthCheckGracePeriod: Duration.seconds(120),
      // Fail (and roll back) quickly when new tasks cannot start healthy.
      circuitBreaker: {
        enable: true,
        rollback: true,
      },
    });

    // LOAD BALANCING SETUP
    // =========================

    // Create the target group
    const tg = new elb.ApplicationTargetGroup(this, 'ConductorTG', {
      port: this.internalPort,
      protocol: elb.ApplicationProtocol.HTTP,
      targetType: elb.TargetType.IP,
      healthCheck: {
        enabled: true,
        // GET /up is bound before Couch migrate (old images already served
        // this path). Do not probe readiness — ECS treats ALB fail as death.
        healthyHttpCodes: '200',
        protocol: elb.Protocol.HTTP,
        interval: Duration.seconds(30),
        timeout: Duration.seconds(5),
        port: this.internalPort.toString(),
        path: '/up',
      },
      vpc: props.vpc,
    });

    // Add the Fargate service to target group
    tg.addTarget(this.fargateService);

    // Add HTTP redirected HTTPS service to ALB against target group
    props.sharedBalancer.addHttpRedirectedConditionalHttpsTarget(
      'conductor',
      tg,
      [elb.ListenerCondition.hostHeaders([props.domainName])],
      100, // TODO: Understand and consider priorities
      100
    );

    // AUTO SCALING SETUP
    // ==================

    // ECS Auto Scaling
    const scaling = this.fargateService.autoScaleTaskCount({
      minCapacity: props.config.autoScaling.minCapacity,
      maxCapacity: props.config.autoScaling.maxCapacity,
    });

    // Configure CPU utilization based auto scaling
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: props.config.autoScaling.targetCpuUtilization,
      scaleInCooldown: Duration.seconds(
        props.config.autoScaling.scaleInCooldown
      ),
      scaleOutCooldown: Duration.seconds(
        props.config.autoScaling.scaleOutCooldown
      ),
    });

    // Configure memory utilization based auto scaling
    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent:
        props.config.autoScaling.targetMemoryUtilization,
      scaleInCooldown: Duration.seconds(
        props.config.autoScaling.scaleInCooldown
      ),
      scaleOutCooldown: Duration.seconds(
        props.config.autoScaling.scaleOutCooldown
      ),
    });

    // DNS ROUTES
    // ===========

    // Route from conductor domain to ALB (alias targets ignore TTL)
    new r53.ARecord(this, 'conductorRoute', {
      zone: props.hz,
      recordName: props.domainName,
      comment: `Route from ${props.domainName} to Conductor ECS service through ALB`,
      target: r53.RecordTarget.fromAlias(
        new r53Targets.LoadBalancerTarget(props.sharedBalancer.alb)
      ),
    });

    // PERMISSIONS
    // ==================

    // Grant permission to read the private key secret
    sm.Secret.fromSecretCompleteArn(
      this,
      'privateKeySecret',
      props.privateKeySecretArn
    ).grantRead(conductorTaskDfn.taskRole);

    // NETWORK SECURITY
    // ================

    // Allow inbound traffic from the ALB
    this.serviceSecurityGroup.connections.allowFrom(
      props.sharedBalancer.alb,
      ec2.Port.tcp(this.internalPort),
      'Allow traffic from ALB to Conductor Fargate Service'
    );
  }
}
