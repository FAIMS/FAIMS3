/*
 * Created Date: Thursday July 25th 2024
 * Author: Peter Baker
 * -----
 * Last Modified: Thursday July 25th 2024 9:36:03 am
 * Modified By: Peter Baker
 * -----
 * Description: Basic ECS cluster with redundant LB.
 * -----
 * HISTORY:
 * Date      	By	Comments
 * ----------	---	---------------------------------------------------------
 *
 * 25-07-2024 | Peter Baker | TODO - use the same LB as the couch DB network to save $$$.
 */

import { Duration, RemovalPolicy } from "aws-cdk-lib";
import * as r53 from "aws-cdk-lib/aws-route53";
import * as sm from "aws-cdk-lib/aws-secretsmanager";
import * as r53Targets from "aws-cdk-lib/aws-route53-targets";
import { ICertificate } from "aws-cdk-lib/aws-certificatemanager";
import { IVpc, Port, SecurityGroup } from "aws-cdk-lib/aws-ec2";
import {
  AppProtocol,
  Cluster,
  ContainerImage,
  Secret as ECSSecret,
  FargateService,
  FargateTaskDefinition,
  LogDriver,
} from "aws-cdk-lib/aws-ecs";
import * as elb from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { IHostedZone } from "aws-cdk-lib/aws-route53";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { getPathToRoot } from "../util/mono";
import { SharedBalancer } from "./networking";

export interface FaimsConductorProps {
  // VPC to produce ECS cluster in
  vpc: IVpc;
  // Balancer to use
  sharedBalancer: SharedBalancer;
  // The CPU allocation for the service
  cpu: number;
  // The memory allocation for the service
  memory: number;
  // Full domain name for service
  domainName: string;
  // The ARN to secret containing pub/private key in AWS secret manager - see scripts/genKeyAWS.sh
  privateKeySecretArn: string;

  // The HZ to produce record in
  hz: IHostedZone;
  // The DNS cert to use for domain LB
  certificate: ICertificate;

  // Couch db config

  // admin password secret
  couchDbAdminSecret: Secret;
  // couch db port
  couchDBPort: number;
  // couch endpoint (format: https://domain:port)
  couchDBEndpoint: string;

  // What endpoints for web-front ends - used in the conductor response for
  // token to direct front-end
  webAppPublicUrl: string;
  androidAppPublicUrl: string;
  iosAppPublicUrl: string;
}
export class FaimsConductor extends Construct {
  internalPort: number = 8000;
  // HTTPS port 443
  externalPort: number = 443;
  // Endpoint for conductor access (format: https://domain:port)
  conductorEndpoint: string;
  // The Fargate Service
  fargateService: FargateService;

  constructor(scope: Construct, id: string, props: FaimsConductorProps) {
    super(scope, id);

    // AUXILIARY SETUP
    // ================

    // cookie auth secret gen at deploy time
    const cookieSecret = new Secret(this, "conductor-cookie-secret", {
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

    // Setup container
    const conductorContainerImage = ContainerImage.fromAsset(getPathToRoot(), {
      file: "api/Dockerfile",
      // TODO optimise this - this avoids infinite loops
      exclude: ["infrastructure"],
    });

    // Create the task definition
    const conductorTaskDfn = new FargateTaskDefinition(
      this,
      "conductor-task-dfn",
      {
        // 20GB ephemeral storage (minimum)
        ephemeralStorageGiB: 21,
        cpu: props.cpu,
        memoryLimitMiB: props.memory,
      }
    );

    // Create the CouchDB container definition within the task dfn
    // TODO deploy from versioned docker image instead of building using CDK
    const conductorContainerDfn = conductorTaskDfn.addContainer(
      "conductor-container-dfn",
      {
        // build from the root, but target the api docker file
        image: conductorContainerImage,
        portMappings: [
          // Map 8000 internal to 8080 external
          {
            containerPort: this.internalPort,
            appProtocol: AppProtocol.http,
            name: "conductor-port",
          },
        ],
        // Pass in the admin/password combination securely
        environment: {
          PROFILE_NAME: "default",
          CONDUCTOR_INSTANCE_NAME: "AWS FAIMS 3 Deployment",
          // password is secret
          COUCHDB_EXTERNAL_PORT: `${props.couchDBPort}`,

          // in our case we use the same internal/external couchDB URL
          COUCHDB_PUBLIC_URL: props.couchDBEndpoint,

          // TODO improve networking to talk over http inside cluster to avoid
          // external traffic
          COUCHDB_INTERNAL_URL: props.couchDBEndpoint,
          CONDUCTOR_PUBLIC_URL: this.conductorEndpoint,

          // TODO setup google auth
          CONDUCTOR_AUTH_PROVIDERS: "google",
          GOOGLE_CLIENT_ID: "replace-me",
          GOOGLE_CLIENT_SECRET: "replace-me",

          // URLs
          WEB_APP_PUBLIC_URL: props.webAppPublicUrl,
          ANDROID_APP_PUBLIC_URL: props.androidAppPublicUrl,
          IOS_APP_PUBLIC_URL: props.iosAppPublicUrl,

          // TODO setup email
          // You will need to set up a valid SMTP connection
          CONDUCTOR_EMAIL_FROM_ADDRESS: "noreply@localhost.test",
          // Usernames with @ should be escaped %40
          // Documentation for string is at https://nodemailer.com/smtp/
          CONDUCTOR_EMAIL_HOST_CONFIG:
            "smtps://username:password@smtp.example.test",

          // TODO setup git revision properly
          COMMIT_VERSION: "todo",

          // The AWS Secret Manager secret ARN for the public/private RSA key
          // pair (not secure value - protected by AWS retrieved at runtime)
          KEY_SOURCE: "AWS_SM",
          AWS_SECRET_KEY_ARN: props.privateKeySecretArn,
        },
        secrets: {
          COUCHDB_PASSWORD: ECSSecret.fromSecretsManager(
            props.couchDbAdminSecret,
            // Use the password field
            "password"
          ),
          COUCHDB_USER: ECSSecret.fromSecretsManager(
            props.couchDbAdminSecret,
            // Use the password field
            "username"
          ),
          FAIMS_COOKIE_SECRET: ECSSecret.fromSecretsManager(cookieSecret),
        },
        logging: LogDriver.awsLogs({
          streamPrefix: "faims-conductor",
          logRetention: RetentionDays.ONE_MONTH,
        }),
      }
    );

    // CLUSTER AND SERVICE SETUP
    // =========================

    // Create the ECS Cluster
    const cluster = new Cluster(this, "ConductorCluster", {
      vpc: props.vpc,
    });

    // Create Security Group for the Fargate service
    const serviceSecurityGroup = new SecurityGroup(this, "ConductorServiceSG", {
      vpc: props.vpc,
      allowAllOutbound: true,
      description: "Security group for Conductor Fargate service",
    });

    // Create Fargate Service
    this.fargateService = new FargateService(this, "conductor-service", {
      cluster: cluster,
      taskDefinition: conductorTaskDfn,
      // TODO clustering configuration
      desiredCount: 1,
      securityGroups: [serviceSecurityGroup],
      // TODO Change this if using private subnets with NAT
      assignPublicIp: true,
    });

    // LOAD BALANCING SETUP
    // =========================

    // Create the target group
    const tg = new elb.ApplicationTargetGroup(this, "ConductorTG", {
      port: this.internalPort,
      protocol: elb.ApplicationProtocol.HTTP,
      targetType: elb.TargetType.IP,
      // Health check configuration for conductor
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

    // Add the fargate service to target group
    tg.addTarget(this.fargateService);

    // Add HTTP redirected HTTPS service to ALB against target group
    props.sharedBalancer.addHttpRedirectedConditionalHttpsTarget(
      "conductor",
      tg,
      [elb.ListenerCondition.hostHeaders([props.domainName])],
      // TODO understand and consider priorities
      100,
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

    // Route from conductor domain -> ALB
    new r53.ARecord(this, "conductorRoute", {
      zone: props.hz,
      recordName: props.domainName,
      comment: `Route from ${props.domainName} to Conductor ECS service through ALB`,
      ttl: Duration.minutes(30),
      target: r53.RecordTarget.fromAlias(r53Targets.LoadBalancerTarget),
    });

    // PERMISSIONS
    // ==================

    // Grant permission to read the private key secret
    sm.Secret.fromSecretCompleteArn(
      this,
      "privateKeySecret",
      props.privateKeySecretArn
    ).grantRead(conductorTaskDfn.taskRole);

    // NETWORK SECURITY
    // ================

    // Allow inbound traffic from the ALB
    serviceSecurityGroup.connections.allowFrom(
      props.sharedBalancer.alb,
      Port.tcp(this.internalPort),
      "Allow traffic from ALB to Conductor Fargate Service"
    );

    // OUTPUTS
    // ================

    // build the public URL and expose
    this.conductorEndpoint = `https://${props.domainName}:${this.externalPort}`;
  }
}
