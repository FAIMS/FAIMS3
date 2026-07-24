/*
 * ECS Fargate couch-auth-proxy on the shared ALB (public couch.* hostname).
 *
 * See docs/developer/docs/source/markdown/Authorisation/CouchAuthProxyAwsCdk.md
 */

import {Duration} from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elb from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sm from 'aws-cdk-lib/aws-secretsmanager';
import {Construct} from 'constructs';
import {SharedBalancer} from './networking';

/**
 * Properties for the CouchAuthProxy construct
 */
export interface CouchAuthProxyProps {
  /** VPC to produce ECS cluster in */
  vpc: ec2.IVpc;
  /** Shared balancer to use */
  sharedBalancer: SharedBalancer;
  /** Public Couch hostname (same as before cutover), e.g. couch.example.com */
  domainName: string;
  /** The DNS certificate to use for Load Balancer */
  certificate: acm.ICertificate;
  /** Internal Couch base URL, e.g. http://10.0.x.x:5984 */
  couchInternalUrl: string;
  /** CouchDB admin user/password secret (username + password keys) */
  couchAdminSecret: sm.ISecret;
  /** SG on the Couch EC2 instance — receives ingress from this service */
  couchSecurityGroup: ec2.ISecurityGroup;
  /** Allowed CORS origins (app + web) */
  corsOrigins: string[];
  /** Container image repository (no tag) */
  image: string;
  /** Immutable image tag / digest pin */
  imageTag: string;
  /** Fargate CPU units */
  cpu: number;
  /** Fargate memory in MiB */
  memory: number;
  /** Desired task count */
  desiredCount: number;
  /** CouchDB internal port (default 5984) */
  couchInternalPort?: number;
}

/**
 * Fargate service that terminates public Pouch sync on the shared ALB and
 * proxies ACL-filtered requests to VPC-internal CouchDB.
 */
export class CouchAuthProxy extends Construct {
  /** Internal container port */
  public readonly internalPort: number = 8000;
  /** External HTTPS port on the ALB */
  public readonly externalPort: number = 443;
  /** Public HTTPS endpoint (format: https://domain:443) */
  public readonly publicEndpoint: string;
  /** The Fargate service */
  public readonly service: ecs.FargateService;
  /** Security group attached to the service (for Couch ingress) */
  public readonly serviceSecurityGroup: ec2.SecurityGroup;
  /** ALB target group */
  public readonly targetGroup: elb.ApplicationTargetGroup;

  constructor(scope: Construct, id: string, props: CouchAuthProxyProps) {
    super(scope, id);

    const couchPort = props.couchInternalPort ?? 5984;

    this.publicEndpoint = `https://${props.domainName}:${this.externalPort}`;

    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      'couch-auth-proxy-task-dfn',
      {
        cpu: props.cpu,
        memoryLimitMiB: props.memory,
      }
    );

    taskDefinition.addContainer('couch-auth-proxy-container', {
      image: ecs.ContainerImage.fromRegistry(
        `${props.image}:${props.imageTag}`
      ),
      portMappings: [
        {
          containerPort: this.internalPort,
          appProtocol: ecs.AppProtocol.http,
          name: 'couch-auth-proxy-port',
        },
      ],
      environment: {
        COUCH_URL: props.couchInternalUrl,
        // Harden ACL scope — never ACL people/projects/auth DBs
        ACL_DB_INCLUDE: '/^data-/',
        ACL_ROUTE_INCLUDE: 'pouch-sync,session',
        // FAIMS provisions `_design/acl` via init / DATA migration
        ACL_AUTO_INSTALL: 'false',
        AUTH_RESOLVE_VIA_COUCH_SESSION: 'true',
        CORS_ORIGINS: props.corsOrigins.join(','),
        PORT: `${this.internalPort}`,
        HOST: '0.0.0.0',
      },
      secrets: {
        COUCH_ADMIN_USER: ecs.Secret.fromSecretsManager(
          props.couchAdminSecret,
          'username'
        ),
        COUCH_ADMIN_PASSWORD: ecs.Secret.fromSecretsManager(
          props.couchAdminSecret,
          'password'
        ),
      },
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: 'couch-auth-proxy',
        logRetention: logs.RetentionDays.ONE_MONTH,
      }),
    });

    props.couchAdminSecret.grantRead(taskDefinition.taskRole);

    const cluster = new ecs.Cluster(this, 'CouchAuthProxyCluster', {
      vpc: props.vpc,
    });

    this.serviceSecurityGroup = new ec2.SecurityGroup(
      this,
      'CouchAuthProxyServiceSG',
      {
        vpc: props.vpc,
        allowAllOutbound: true,
        description: 'Security group for couch-auth-proxy Fargate service',
      }
    );

    this.service = new ecs.FargateService(this, 'couch-auth-proxy-service', {
      cluster,
      taskDefinition,
      desiredCount: props.desiredCount,
      securityGroups: [this.serviceSecurityGroup],
      // Same as Conductor: public subnets, no NAT in this stack
      assignPublicIp: true,
    });

    this.targetGroup = new elb.ApplicationTargetGroup(
      this,
      'CouchAuthProxyTG',
      {
        port: this.internalPort,
        protocol: elb.ApplicationProtocol.HTTP,
        targetType: elb.TargetType.IP,
        healthCheck: {
          enabled: true,
          healthyHttpCodes: '200',
          protocol: elb.Protocol.HTTP,
          interval: Duration.seconds(30),
          timeout: Duration.seconds(5),
          port: this.internalPort.toString(),
          path: '/_couch-auth-proxy/health',
        },
        vpc: props.vpc,
      }
    );

    this.targetGroup.addTarget(this.service);

    // Own the public couch.* host rule (same priority Couch used previously)
    props.sharedBalancer.addHttpRedirectedConditionalHttpsTarget(
      'couch',
      this.targetGroup,
      [elb.ListenerCondition.hostHeaders([props.domainName])],
      110,
      110
    );

    this.serviceSecurityGroup.connections.allowFrom(
      props.sharedBalancer.alb,
      ec2.Port.tcp(this.internalPort),
      'Allow traffic from ALB to couch-auth-proxy'
    );

    props.couchSecurityGroup.connections.allowFrom(
      this.serviceSecurityGroup,
      ec2.Port.tcp(couchPort),
      'Allow couch-auth-proxy to CouchDB'
    );
  }
}
