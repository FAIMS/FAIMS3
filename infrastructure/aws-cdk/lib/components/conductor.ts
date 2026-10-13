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

import {Duration} from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elb from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as r53 from 'aws-cdk-lib/aws-route53';
import * as r53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as sm from 'aws-cdk-lib/aws-secretsmanager';
import {Construct} from 'constructs';
import {getPathToRoot} from '../util/mono';
import {SharedBalancer} from './networking';
import {
  buildEnvMapFromRuntime,
  type EnvValue,
  type RuntimeConfig,
} from '@faims3/build-config';

/**
 * Convert a build-config env value to the string ECS container environment
 * expects. Arrays become CSV; booleans become 'true'/'false'; numbers are
 * stringified. Undefined/null return undefined (the key is omitted).
 */
function envValueToString(value: EnvValue): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value.join(',');
  return String(value);
}
import {AuthProvidersConfig, ConductorConfig} from '../config';

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
   * buildEnvMapFromRuntime(core, 'api') (ADR-0002 §5). */
  coreConfig: RuntimeConfig;
  /** FAIMS_COOKIE_SECRET */
  cookieSecret: sm.Secret;
  /** SMTP credentials secret ARN */
  smtpCredsArn: string;
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
        ephemeralStorageGiB: 21, // 20GB ephemeral storage (minimum)
        cpu: props.config.cpu,
        memoryLimitMiB: props.config.memory,
      }
    );

    // Add container to the task definition
    const smtpSecret = sm.Secret.fromSecretCompleteArn(
      this,
      'SMTPSecret',
      props.smtpCredsArn
    );

    // Configure auth providers
    // Based on the configuration we generate two sets of environment variables
    // for secret and non-secret settings for each provider.
    const authSecrets: Record<string, ecs.Secret> = {};
    const authEnvironment: Record<string, string> = {};
    if (props.authProviders && props.authProviders.providers.length > 0) {
      const authSecret = sm.Secret.fromSecretCompleteArn(
        this,
        'AuthSecret',
        props.authProviders.secretArn
      );
      // The secret field names per provider type - resolved from AWS Secrets
      // Manager at runtime. These must be present in the final deployment.
      const SECRET_FIELDS: Record<string, string[]> = {
        saml: ['privateKey', 'publicKey'],
        google: ['clientID', 'clientSecret'],
        oidc: ['clientID', 'clientSecret'],
      };
      props.authProviders.providers.forEach(provider => {
        // The provider definitions live in core.authProviders (build-config).
        const rawConfig = props.coreConfig.authProviders[provider];
        // Merge any secret values present in core.secrets.auth.authProviders
        // (typically empty for the CDK - they resolve from the SM via the
        // authSecrets references below; present for SOPS/local deployments).
        const mergedSecrets =
          props.coreConfig.secrets?.auth?.authProviders?.[provider];
        const config = {...rawConfig, ...mergedSecrets};

        // Guard: ensure every secret the API needs is wired up. For the CDK
        // these come from the SM (authSecrets), so require either an explicit
        // value in the config or a generated SM reference for each field.
        const required = SECRET_FIELDS[config.type] ?? [];
        const missing = required.filter(field => {
          const hasValue =
            typeof config[field as keyof typeof config] === 'string' &&
            (config[field as keyof typeof config] as string).trim() !== '';
          const hasSmRef = Object.keys(authSecrets).some(k =>
            k.endsWith(camelToSnakeCase(field))
          );
          return !hasValue && !hasSmRef;
        });

        // Handle secrets based on provider type
        if (config.type === 'saml') {
          // SAML uses privateKey and publicKey (certificate) instead of clientID/clientSecret
          authSecrets[`AUTH_${provider.toUpperCase()}_PRIVATE_KEY`] =
            ecs.Secret.fromSecretsManager(authSecret, `${provider}-privateKey`);
          authSecrets[`AUTH_${provider.toUpperCase()}_PUBLIC_KEY`] =
            ecs.Secret.fromSecretsManager(authSecret, `${provider}-publicKey`);
        } else {
          // Google and OIDC use clientID and clientSecret
          authSecrets[`AUTH_${provider.toUpperCase()}_CLIENT_ID`] =
            ecs.Secret.fromSecretsManager(authSecret, `${provider}-clientID`);
          authSecrets[`AUTH_${provider.toUpperCase()}_CLIENT_SECRET`] =
            ecs.Secret.fromSecretsManager(
              authSecret,
              `${provider}-clientSecret`
            );
        }

        if (missing.length > 0) {
          throw new Error(
            `Auth provider '${provider}' (${config.type}) is missing required secret field(s): ${missing.join(', ')}. Provide them in core.secrets.auth.authProviders.${provider} or wire them to the AWS Secrets Manager secret.`
          );
        }

        // For each key in config, convert to an env variable
        // (AUTH_ + provider + _ + key in uppercase) and add to the environment.
        // Secret fields are excluded here - they are delivered via the SM
        // references above, not baked into the container env.
        const secretFieldSet = new Set([...Object.values(SECRET_FIELDS), 'id']);
        for (const [key, value] of Object.entries(config)) {
          // Skip undefined/null values and secret fields
          if (value === undefined || value === null) {
            continue;
          }
          if (secretFieldSet.has(key)) {
            continue;
          }

          const envName = `AUTH_${provider.toUpperCase()}_${camelToSnakeCase(key)}`;

          // Handle different value types appropriately
          if (Array.isArray(value)) {
            // For arrays (e.g., authnContext), join with commas
            authEnvironment[envName] = value.join(',');
          } else if (typeof value === 'object') {
            // For objects, stringify to JSON
            authEnvironment[envName] = JSON.stringify(value);
          } else {
            authEnvironment[envName] = String(value);
          }

          console.log('ENV', envName, authEnvironment[envName]);
        }
      });
    }

    // Expose env/secrets so sibling one-shot tasks (e.g. TTL cleanup) can reuse
    // the same Couch + KEY_SOURCE bootstrapping without duplicating the block.
    //
    // The shared API env (branding, endpoints, limits, migration, email, token
    // expiries, etc.) comes from build-config's apiContract via
    // buildEnvMapFromRuntime(core, 'api') - the same contract the app/api use to
    // parse their env, so the deployed env is guaranteed to parse. Only the
    // genuinely AWS-specific bits (resolved endpoints, KEY_SOURCE/SM ARN,
    // PROFILE_NAME, redirect whitelist, auth-provider fields) are overlaid here.
    const sharedEnv = buildEnvMapFromRuntime(props.coreConfig, 'api');
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(sharedEnv)) {
      const str = envValueToString(value);
      if (str !== undefined) env[key] = str;
    }
    // AWS-specific overrides (the core config's defaults are for local dev).
    env.PROFILE_NAME = 'default';
    env.KEY_SOURCE = 'AWS_SM';
    env.AWS_SECRET_KEY_ARN = props.privateKeySecretArn;
    // The concrete endpoints are resolved by the CDK from the deployed domains
    // (not stored in the core config).
    env.COUCHDB_PUBLIC_URL = props.couchDBEndpoint;
    env.COUCHDB_INTERNAL_URL = props.couchDBEndpoint;
    env.CONDUCTOR_PUBLIC_URL = this.conductorEndpoint;
    env.CONDUCTOR_URL = this.conductorEndpoint;
    // Whitelisting for redirects - should include API, APP, WEB and APP_ID://
    env.REDIRECT_WHITELIST = [
      this.conductorEndpoint,
      props.webAppPublicUrl,
      props.webUrl,
      `${props.appId}://`,
      ...(props.localhostWhitelist
        ? [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:8080',
            'http://localhost:8000',
          ]
        : []),
    ].join(',');
    // Auth-provider non-secret fields (from core.authProviders).
    Object.assign(env, authEnvironment);

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

    // The SM-delivered secrets must not also be set as plain env vars (ECS
    // prefers `secrets`, but the api's strict parse would otherwise see a
    // placeholder from the shared contract). Drop the overlapping keys.
    for (const key of Object.keys(this.secrets)) {
      delete env[key];
    }
    this.environment = env;

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

const camelToSnakeCase = (str: string): string => {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toUpperCase();
};
