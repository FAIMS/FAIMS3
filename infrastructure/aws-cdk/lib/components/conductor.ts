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

import { Duration, RemovalPolicy } from "aws-cdk-lib";
import * as r53 from "aws-cdk-lib/aws-route53";
import * as sm from "aws-cdk-lib/aws-secretsmanager";
import * as r53Targets from "aws-cdk-lib/aws-route53-targets";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elb from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import { getPathToRoot } from "../util/mono";
import { SharedBalancer } from "./networking";

/**
 * Properties for the FaimsConductor construct
 */
export interface FaimsConductorProps {
  /** VPC to produce ECS cluster in */
  vpc: ec2.IVpc;
  /** Shared balancer to use */
  sharedBalancer: SharedBalancer;
  /** The CPU allocation for the service */
  cpu: number;
  /** The memory allocation for the service */
  memory: number;
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
  /** Public URL for web app */
  webAppPublicUrl: string;
  /** Public URL for Android app */
  androidAppPublicUrl: string;
  /** Public URL for iOS app */
  iosAppPublicUrl: string;
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

    // AUXILIARY SETUP
    // ================

    // Generate cookie auth secret at deploy time
    const cookieSecret = new sm.Secret(this, "conductor-cookie-secret", {
      description: "Contains a randomly generated string used for cookie auth",
      removalPolicy: RemovalPolicy.DESTROY,
      generateSecretString: {
        includeSpace: false,
        passwordLength: 25,
        excludePunctuation: true,
      },
    });

    // CONTAINER SETUP
    // ================

    // Setup container image from local Dockerfile
    const conductorContainerImage = ecs.ContainerImage.fromAsset(getPathToRoot(), {
      file: "api/Dockerfile",
      // TODO: Optimize this - this avoids infinite loops
      exclude: ["infrastructure"],
    });

    // Create the Fargate task definition
    const conductorTaskDfn = new ecs.FargateTaskDefinition(this, "conductor-task-dfn", {
      ephemeralStorageGiB: 21, // 20GB ephemeral storage (minimum)
      cpu: props.cpu,
      memoryLimitMiB: props.memory,
    });

    // Add container to the task definition
    const conductorContainerDfn = conductorTaskDfn.addContainer("conductor-container-dfn", {
      image: conductorContainerImage,
      portMappings: [
        {
          containerPort: this.internalPort,
          appProtocol: ecs.AppProtocol.http,
          name: "conductor-port",
        },
      ],
      environment: {
        PROFILE_NAME: "default",
        CONDUCTOR_INSTANCE_NAME: "AWS FAIMS 3 Deployment",
        COUCHDB_EXTERNAL_PORT: `${props.couchDBPort}`,
        COUCHDB_PUBLIC_URL: props.couchDBEndpoint,
        COUCHDB_INTERNAL_URL: props.couchDBEndpoint,
        CONDUCTOR_PUBLIC_URL: this.conductorEndpoint,
        // TODO Setup Google auth
        CONDUCTOR_AUTH_PROVIDERS: "google",
        GOOGLE_CLIENT_ID: "replace-me",
        GOOGLE_CLIENT_SECRET: "replace-me",
        WEB_APP_PUBLIC_URL: props.webAppPublicUrl,
        ANDROID_APP_PUBLIC_URL: props.androidAppPublicUrl,
        IOS_APP_PUBLIC_URL: props.iosAppPublicUrl,
        // TODO Setup email
        CONDUCTOR_EMAIL_FROM_ADDRESS: "noreply@localhost.test",
        CONDUCTOR_EMAIL_HOST_CONFIG: "smtps://username:password@smtp.example.test",
        // TODO Setup git revision properly
        COMMIT_VERSION: "todo",
        KEY_SOURCE: "AWS_SM",
        AWS_SECRET_KEY_ARN: props.privateKeySecretArn,
      },
      secrets: {
        COUCHDB_PASSWORD: ecs.Secret.fromSecretsManager(props.couchDbAdminSecret, "password"),
        COUCHDB_USER: ecs.Secret.fromSecretsManager(props.couchDbAdminSecret, "username"),
        FAIMS_COOKIE_SECRET: ecs.Secret.fromSecretsManager(cookieSecret),
      },
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: "faims-conductor",
        logRetention: logs.RetentionDays.ONE_MONTH,
      }),
    });

    // CLUSTER AND SERVICE SETUP
    // =========================

    // Create the ECS Cluster
    const cluster = new ecs.Cluster(this, "ConductorCluster", {
      vpc: props.vpc,
    });

    // Create Security Group for the Fargate service
    const serviceSecurityGroup = new ec2.SecurityGroup(this, "ConductorServiceSG", {
      vpc: props.vpc,
      allowAllOutbound: true,
      description: "Security group for Conductor Fargate service",
    });

    // Create Fargate Service
    this.fargateService = new ecs.FargateService(this, "conductor-service", {
      cluster: cluster,
      taskDefinition: conductorTaskDfn,
      desiredCount: 1,
      securityGroups: [serviceSecurityGroup],
      assignPublicIp: true, // TODO Change this if using private subnets with NAT
    });

    // LOAD BALANCING SETUP
    // =========================

    // Create the target group
    const tg = new elb.ApplicationTargetGroup(this, "ConductorTG", {
      port: this.internalPort,
      protocol: elb.ApplicationProtocol.HTTP,
      targetType: elb.TargetType.IP,
      healthCheck: {
        enabled: true,
        healthyHttpCodes: "200,302",
        protocol: elb.Protocol.HTTP,
        interval: Duration.seconds(30),
        timeout: Duration.seconds(5),
        port: this.internalPort.toString(),
        path: "/",
      },
      vpc: props.vpc,
    });

    // Add the Fargate service to target group
    tg.addTarget(this.fargateService);

    // Add HTTP redirected HTTPS service to ALB against target group
    props.sharedBalancer.addHttpRedirectedConditionalHttpsTarget(
      "conductor",
      tg,
      [elb.ListenerCondition.hostHeaders([props.domainName])],
      100, // TODO: Understand and consider priorities
      100
    );

    // AUTO SCALING SETUP
    // ==================

    // TODO Configure auto scaling properly
    this.fargateService
      .autoScaleTaskCount({
        minCapacity: 1,
        maxCapacity: 1,
      })
      .scaleOnRequestCount("conductorAutoScaling", {
        targetGroup: tg,
        requestsPerTarget: 10,
        scaleInCooldown: Duration.seconds(180),
        scaleOutCooldown: Duration.seconds(60),
      });

    // DNS ROUTES
    // ===========

    // Route from conductor domain to ALB
    new r53.ARecord(this, "conductorRoute", {
      zone: props.hz,
      recordName: props.domainName,
      comment: `Route from ${props.domainName} to Conductor ECS service through ALB`,
      ttl: Duration.minutes(30),
      target: r53.RecordTarget.fromAlias(new r53Targets.LoadBalancerTarget(props.sharedBalancer.alb)),
    });

    // PERMISSIONS
    // ==================

    // Grant permission to read the private key secret
    sm.Secret.fromSecretCompleteArn(this, "privateKeySecret", props.privateKeySecretArn)
      .grantRead(conductorTaskDfn.taskRole);

    // NETWORK SECURITY
    // ================

    // Allow inbound traffic from the ALB
    serviceSecurityGroup.connections.allowFrom(
      props.sharedBalancer.alb,
      ec2.Port.tcp(this.internalPort),
      "Allow traffic from ALB to Conductor Fargate Service"
    );

    // OUTPUTS
    // ================

    // Build the public URL and expose
    this.conductorEndpoint = `https://${props.domainName}:${this.externalPort}`;
  }
}