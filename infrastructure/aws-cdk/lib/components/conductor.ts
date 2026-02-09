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
import {AuthProvidersConfig, ConductorConfig} from '../config';

const DEFAULT_SMTP_CACHE_EXPIRY = 300;

/**
 * SMTP credentials secret structure
 *
 * The AWS Secrets Manager secret should contain the following fields:
 * - host: SMTP server hostname (string)
 * - port: SMTP server port (number)
 * - secure: Whether to use TLS/SSL (boolean) e.g. true/false
 * - user: SMTP authentication username (string)
 * - pass: SMTP authentication password (string)
 */

/**
 * General SMTP configuration for email service
 */
export interface SMTPGeneralConfig {
  /** Email service type (SMTP or MOCK) */
  emailServiceType: string;
  /** From email address */
  fromEmail: string;
  /** From name */
  fromName: string;
  /** Reply-to email address (optional) */
  replyTo?: string;
  /** Test email address for admin verification */
  testEmailAddress: string;
  /** Cache expiry in seconds (optional) */
  cacheExpirySeconds?: number;
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
  /** Public URL for Android app */
  androidAppPublicUrl: string;
  /** Public URL for iOS app */
  iosAppPublicUrl: string;
  /** iOS/Android APP_ID */
  appId: string;
  /** The configuration object for the Conductor service */
  config: ConductorConfig;
  /** FAIMS_COOKIE_SECRET */
  cookieSecret: sm.Secret;
  /** SMTP credentials secret ARN */
  smtpCredsArn: string;
  /** SMTP general configuration */
  smtpConfig: SMTPGeneralConfig;
  /** Social providers info (if enabled) */
  authProviders?: AuthProvidersConfig;
  /** If true, adds typical localhost addresses to the allowable redirect
   * whitelist (DEV ONLY) */
  localhostWhitelist: boolean;
  /** Maximum long-lived token duration in days (undefined = infinite) */
  maximumLongLivedDurationDays?: number;
  /** Bugsnag config */
  /** Version e.g. v1.2.3 */
  apiVersion?: string;
  /** Bugsnag API key */
  bugsnagApiKey?: string;
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
    let conductorContainerImage: ecs.ContainerImage;

    if (useDockerHub) {
      // Setup container image from DockerHub image
      conductorContainerImage = ecs.ContainerImage.fromRegistry(
        `${props.config.conductorDockerImage}:${props.config.conductorDockerImageTag}`
      );
    } else {
      // Build and bundle with cdk and ECR
      conductorContainerImage = ecs.ContainerImage.fromAsset(getPathToRoot(), {
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
      props.authProviders.providers.forEach(provider => {
        const config = props.authProviders!.config[provider];

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

        // For each key in config, convert to an env variable
        // (AUTH_ + provider + _ + key in uppercase) and add to the environment

        for (const [key, value] of Object.entries(config)) {
          // Skip undefined/null values
          if (value === undefined || value === null) {
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

    conductorTaskDfn.addContainer('conductor-container-dfn', {
      image: conductorContainerImage,
      portMappings: [
        {
          containerPort: this.internalPort,
          appProtocol: ecs.AppProtocol.http,
          name: 'conductor-port',
        },
      ],
      environment: {
        PROFILE_NAME: 'default',
        CONDUCTOR_INSTANCE_NAME: props.config.name,
        CONDUCTOR_DESCRIPTION: props.config.description,
        COUCHDB_EXTERNAL_PORT: `${props.couchDBPort}`,
        COUCHDB_PUBLIC_URL: props.couchDBEndpoint,
        COUCHDB_INTERNAL_URL: props.couchDBEndpoint,
        CONDUCTOR_SHORT_CODE_PREFIX: props.config.shortCodePrefix,
        // Conductor API URLs
        CONDUCTOR_PUBLIC_URL: this.conductorEndpoint,
        CONDUCTOR_URL: this.conductorEndpoint,
        WEB_APP_PUBLIC_URL: props.webAppPublicUrl,
        ANDROID_APP_PUBLIC_URL: props.androidAppPublicUrl,
        IOS_APP_PUBLIC_URL: props.iosAppPublicUrl,
        KEY_SOURCE: 'AWS_SM',
        AWS_SECRET_KEY_ARN: props.privateKeySecretArn,
        NEW_CONDUCTOR_URL: props.webUrl,

        // Bugsnag (optional)
        ...(props.bugsnagApiKey ? {BUGSNAG_API_KEY: props.bugsnagApiKey} : {}),

        // add any auth environment variables
        ...authEnvironment,

        // Security configurations
        MAXIMUM_LONG_LIVED_DURATION_DAYS: props.maximumLongLivedDurationDays
          ? props.maximumLongLivedDurationDays.toString()
          : 'infinite',

        // Email Service Configuration
        EMAIL_SERVICE_TYPE: props.smtpConfig.emailServiceType,
        EMAIL_FROM_ADDRESS: props.smtpConfig.fromEmail,
        EMAIL_FROM_NAME: props.smtpConfig.fromName,
        EMAIL_REPLY_TO: props.smtpConfig.replyTo || props.smtpConfig.fromEmail,
        TEST_EMAIL_ADDRESS: props.smtpConfig.testEmailAddress,
        SMTP_CACHE_EXPIRY_SECONDS: `${props.smtpConfig.cacheExpirySeconds || DEFAULT_SMTP_CACHE_EXPIRY}`,

        // Whitelisting for redirects - should include API, APP, WEB and APP_ID://
        REDIRECT_WHITELIST: [
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
        ].join(','),
      },
      secrets: {
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
      },
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: 'faims-conductor',
        logRetention: logs.RetentionDays.ONE_MONTH,
      }),
    });

    // CLUSTER AND SERVICE SETUP
    // =========================

    // Create the ECS Cluster
    const cluster = new ecs.Cluster(this, 'ConductorCluster', {
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
    const serviceSecurityGroup = new ec2.SecurityGroup(
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
      cluster: cluster,
      taskDefinition: conductorTaskDfn,
      // Target number of tasks to run
      desiredCount: props.config.autoScaling.desiredCapacity,
      securityGroups: [serviceSecurityGroup],
      assignPublicIp: true, // TODO Change this if using private subnets with NAT
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
        healthyHttpCodes: '200,302',
        protocol: elb.Protocol.HTTP,
        interval: Duration.seconds(30),
        timeout: Duration.seconds(5),
        port: this.internalPort.toString(),
        path: '/',
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

    // Route from conductor domain to ALB
    new r53.ARecord(this, 'conductorRoute', {
      zone: props.hz,
      recordName: props.domainName,
      comment: `Route from ${props.domainName} to Conductor ECS service through ALB`,
      ttl: Duration.minutes(30),
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
    serviceSecurityGroup.connections.allowFrom(
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
