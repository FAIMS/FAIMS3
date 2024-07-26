import { RemovalPolicy } from "aws-cdk-lib";
import { ICertificate } from "aws-cdk-lib/aws-certificatemanager";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import {
    AppProtocol,
    ContainerImage,
    Secret as ECSSecret,
    FargateTaskDefinition,
    ICluster,
    IFargateService,
    LogDriver,
} from "aws-cdk-lib/aws-ecs";
import { ApplicationLoadBalancedFargateService } from "aws-cdk-lib/aws-ecs-patterns";
import {
    ApplicationLoadBalancer,
    ApplicationProtocol,
} from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { IHostedZone } from "aws-cdk-lib/aws-route53";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

export interface FaimsCouchDBProps {
  // VPC to produce ECS cluster in
  vpc: IVpc;
  // The CPU allocation for the service
  cpu: number;
  // The memory allocation for the service
  memory: number;
  // Full domain name for service
  domainName: string;
  // The HZ to produce record in
  hz: IHostedZone;
  // The DNS cert to use for domain LB
  certificate: ICertificate;
}

export class FaimsCouchDB extends Construct {
  // Couch-db port
  internalPort: number = 5984;
  exposedPort: number = 443;

  // Endpoint for couch access
  couchEndpoint: string;

  // The fargate service running couch
  ecsCluster: ICluster;
  fargateService: IFargateService;
  loadBalancer: ApplicationLoadBalancer;

  // Admin password secret
  passwordSecret: Secret;

  constructor(scope: Construct, id: string, props: FaimsCouchDBProps) {
    super(scope, id);

    // Simple service just expose port 5984 ECS -> what about SSL or we do we let load balancer handle this? Let's do that.

    // TODO fix mount setup - getting error below

    /*
    failed to invoke EFS utils commands to set up EFS volumes: stderr:
    b'mount.nfs4: access denied by server while mounting 127.0.0.1:/' :
    */

    // Need to use EFS volume - EBS service managed volumes don't seem to work
    const VOLUME_NAME = "couchdbdata";

    // Definitions

    //const efsFileSystem = new FileSystem(this, "couch-db-data-efs", {
    //  vpc: props.vpc,
    //  removalPolicy: RemovalPolicy.DESTROY,
    //  encrypted: true,
    //  vpcSubnets: {
    //    subnetType: SubnetType.PRIVATE_ISOLATED,
    //  },
    //});

    // Create the task definition
    const couchDbTaskDfn = new FargateTaskDefinition(this, "couch-task-dfn", {
      // 20GB ephemeral storage
      ephemeralStorageGiB: 21,
      cpu: props.cpu,
      memoryLimitMiB: props.memory,
    });

    // Setup a random secret string for the password
    const adminPasswordSecret = new Secret(this, "couch-db-admin-password", {
      description:
        "Contains the admin password for the couch-db automatically generated",
      removalPolicy: RemovalPolicy.DESTROY,
      generateSecretString: {
        includeSpace: false,
        passwordLength: 20,
        excludePunctuation: true,
      },
    });

    // Create the CouchDB container definition within the task dfn
    const couchDbContainerDefinition = couchDbTaskDfn.addContainer(
      "couchdb-container-dfn",
      {
        image: ContainerImage.fromAsset("../FAIMS3-conductor/couchdb", {}),
        portMappings: [
          {
            containerPort: this.internalPort,
            appProtocol: AppProtocol.http,
            name: "couchdb-port",
          },
        ],
        // Pass in the admin/password combination securely
        environment: {
          COUCHDB_USER: "admin",
        },
        secrets: {
          COUCHDB_PASSWORD: ECSSecret.fromSecretsManager(adminPasswordSecret),
        },
        logging: LogDriver.awsLogs({
          streamPrefix: "faims-couchdb",
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
      "couchdb-lb-service",
      {
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

        // inherit from container health check
        //healthCheck: {
        //  command: ["CMD-SHELL", "curl -f http://localhost/ || exit 1"],
        //},

        // Listen on 443
        listenerPort: this.exposedPort,

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
        taskDefinition: couchDbTaskDfn,

        // Lodge into existing vpc
        vpc: props.vpc,
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

    // Access couch db at HTTPS via domain name on container port e.g. admin console = <below>/_utils
    this.couchEndpoint = `https://${props.domainName}:${this.exposedPort}`;

    // Expose the fargate service and cluster
    this.fargateService = service.service;
    this.ecsCluster = service.cluster;
    this.loadBalancer = service.loadBalancer;

    this.passwordSecret = adminPasswordSecret;
  }
}
