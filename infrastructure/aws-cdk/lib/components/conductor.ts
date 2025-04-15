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
import {ConductorConfig} from '../faims-infra-stack';
import {getPathToRoot} from '../util/mono';
import {SharedBalancer} from './networking';

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

export interface SocialProvidersConfig {
  google?: {
    // must contain CLIENT_ID and CLIENT_SECRET
    secretArn: string;
  };
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
  socialProviders?: SocialProvidersConfig;
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

    const socialProviderList: string[] = [];
    if (props.socialProviders?.google) {
      socialProviderList.push('google');
    }
    const renderedProviderList = socialProviderList.join(';');

    const googleSecretArn = props.socialProviders?.google?.secretArn;
    const googleSecret = googleSecretArn
      ? sm.Secret.fromSecretCompleteArn(
          this,
          'GoogleOAuthSecret',
          googleSecretArn
        )
      : undefined;
    const googleConfigSecrets = googleSecret
      ? {
          GOOGLE_CLIENT_ID: ecs.Secret.fromSecretsManager(
            googleSecret,
            'CLIENT_ID'
          ),
          GOOGLE_CLIENT_SECRET: ecs.Secret.fromSecretsManager(
            googleSecret,
            'CLIENT_SECRET'
          ),
        }
      : undefined;

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

        // Email Service Configuration
        EMAIL_SERVICE_TYPE: props.smtpConfig.emailServiceType,
        EMAIL_FROM_ADDRESS: props.smtpConfig.fromEmail,
        EMAIL_FROM_NAME: props.smtpConfig.fromName,
        EMAIL_REPLY_TO: props.smtpConfig.replyTo || props.smtpConfig.fromEmail,
        TEST_EMAIL_ADDRESS: props.smtpConfig.testEmailAddress,
        SMTP_CACHE_EXPIRY_SECONDS: `${props.smtpConfig.cacheExpirySeconds || DEFAULT_SMTP_CACHE_EXPIRY}`,

        // Whitelising for redirects - should include API, APP, WEB and APP_ID://
        REDIRECT_WHITELIST: [
          this.conductorEndpoint,
          props.webAppPublicUrl,
          props.webUrl,
          `${props.appId}://`,
        ].join(','),

        // social providers (if at least one configured)
        ...(socialProviderList.length > 0
          ? {
              CONDUCTOR_AUTH_PROVIDERS: renderedProviderList,
            }
          : {}),
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

        // Include google config if provided
        ...(googleConfigSecrets ?? {}),
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
      desiredCount: 1,
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
