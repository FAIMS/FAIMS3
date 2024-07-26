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

import { RemovalPolicy } from "aws-cdk-lib";
import { ICertificate } from "aws-cdk-lib/aws-certificatemanager";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import {
  AppProtocol,
  ContainerImage,
  FargateTaskDefinition,
  IFargateService,
  LogDriver,
  Secret as ECSSecret,
} from "aws-cdk-lib/aws-ecs";
import { ApplicationLoadBalancedFargateService } from "aws-cdk-lib/aws-ecs-patterns";
import { ApplicationProtocol } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { IHostedZone } from "aws-cdk-lib/aws-route53";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { getPathToRoot } from "../util/mono";

export interface FaimsConductorProps {
  // VPC to produce ECS cluster in
  vpc: IVpc;
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

  fargateService: IFargateService;

  constructor(scope: Construct, id: string, props: FaimsConductorProps) {
    super(scope, id);

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

    // build the public URL
    this.conductorEndpoint = `https://${props.domainName}:${this.externalPort}`;

    // Create the CouchDB container definition within the task dfn
    // TODO mount keys volume or just copy it
    const conductorContainerDfn = conductorTaskDfn.addContainer(
      "conductor-container-dfn",
      {
        // build from the root, but target the api docker file
        image: ContainerImage.fromAsset(getPathToRoot(), {
          file: "api/Dockerfile",
          // TODO optimise this - this avoids infinite loops
          exclude: ["infrastructure"],
        }),
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
          PROFILE_NAME: "local-dev",
          CONDUCTOR_INSTANCE_NAME: "Example AWS FAIMS",
          COUCHDB_USER: "admin",
          // password is secret
          COUCHDB_EXTERNAL_PORT: `${props.couchDBPort}`,

          // in our case we use the same internal/external couchDB URL
          COUCHDB_PUBLIC_URL: props.couchDBEndpoint,

          // TODO
          // improve networking to talk over http inside cluster to avoid
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
          AWS_KEY_SECRET_ARN: props.privateKeySecretArn,
        },
        secrets: {
          COUCHDB_PASSWORD: ECSSecret.fromSecretsManager(
            props.couchDbAdminSecret
          ),
          FAIMS_COOKIE_SECRET: ECSSecret.fromSecretsManager(cookieSecret),
        },
        logging: LogDriver.awsLogs({
          streamPrefix: "faims-conductor",
          logRetention: RetentionDays.ONE_MONTH,
        }),
      }
    );

    //couchDbTaskDfn.addVolume({
    //  name: VOLUME_NAME,
    //  efsVolumeConfiguration: {
    //    fileSystemId: efsFileSystem.fileSystemId,
    //    transitEncryption: "ENABLED",
    //  },
    //});

    //couchDbContainerDefinition.addMountPoints({
    //  sourceVolume: VOLUME_NAME,
    //  containerPath: "/opt/couchdb/data",
    //  readOnly: false,
    //});

    const service = new ApplicationLoadBalancedFargateService(
      this,
      "conductor-lb-service",
      {
        // reuse the existing cluster and load balancer to save $$$

        // TODO use this class https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs_patterns.ApplicationMultipleTargetGroupsFargateService.html
        // to have multiple TG's into the same service saving $$$
        // loadBalancer: props.loadBalancer,

        // need VPC for now TODO remove
        vpc: props.vpc,

        // Public IP needed to allow for ECS to run properly
        assignPublicIp: true,

        // DNS cert + domain name
        certificate: props.certificate,
        domainName: props.domainName,
        domainZone: props.hz,

        // CPU + memory allocations
        cpu: props.cpu,
        memoryLimitMiB: props.memory,

        // TODO consider clustering?
        desiredCount: 1,

        // Listen on 8080
        listenerPort: this.externalPort,

        // Allow LB traffic from any IP due to need for direct access from user devices
        openListener: true,

        // HTTPS traffic (listener protocol)
        protocol: ApplicationProtocol.HTTPS,

        // Target protocol
        targetProtocol: ApplicationProtocol.HTTP,

        // We need public access to LB
        publicLoadBalancer: true,

        // We don't want any HTTP req's
        redirectHTTP: true,

        // couch db task definition
        taskDefinition: conductorTaskDfn,
      }
    );

    // Setup network access and permissions for file-mount

    // allow the service to r/w to EFS
    //efsFileSystem.connections.allowFrom(service.cluster, Port.allTraffic());
    //efsFileSystem.connections.allowFrom(service.service, Port.allTraffic());

    //// Grant read/write data access at IAM level for both roles as needed

    //// Read-write for the task
    //efsFileSystem.grantReadWrite(couchDbTaskDfn.taskRole);

    //// Admin for the execution role
    //couchDbTaskDfn.executionRole &&
    //  efsFileSystem.grantRootAccess(couchDbTaskDfn.executionRole);

    // inject different health check configuration -> allow redirects
    service.targetGroup.configureHealthCheck({ healthyHttpCodes: "200,302" });

    // Expose the fargate service and cluster
    this.fargateService = service.service;
  }
}
