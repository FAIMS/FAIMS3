/**
 * Capacity manager service plus a spatial-worker task definition.
 *
 * The manager is a tiny always-on Fargate service (desired 1). It starts
 * worker tasks with RunTask when the Couch queue has work. Workers are not
 * an ECS service: when they exit after the idle timeout, nothing replaces
 * them, so compute returns to zero.
 */

import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sm from 'aws-cdk-lib/aws-secretsmanager';
import {Construct} from 'constructs';
import {SpatialCapacityConfig} from '../config';

/** Container name in the worker task definition and RunTask override. */
export const SPATIAL_WORKER_CONTAINER_NAME = 'spatial-worker-container';

/** Container name in the capacity-manager task definition. */
export const CAPACITY_MANAGER_CONTAINER_NAME = 'capacity-manager-container';

/** Compiled worker entry, relative to the production WORKDIR. */
export const buildSpatialWorkerCommand = (): string[] => [
  'node',
  'scripts/spatialWorker.js',
  '--poll',
];

/** Compiled capacity-manager entry, relative to the production WORKDIR. */
export const buildCapacityManagerCommand = (): string[] => [
  'node',
  'scripts/capacityManager.js',
];

export interface FaimsSpatialCapacityProps {
  /** VPC used by Conductor. Workers run in its public subnets. */
  vpc: ec2.IVpc;
  /** Conductor ECS cluster. The manager service and RunTask share it. */
  cluster: ecs.ICluster;
  /** Security groups with Couch egress equivalent to Conductor. */
  securityGroups: ec2.ISecurityGroup[];
  /** Same Docker image as Conductor. */
  containerImage: ecs.ContainerImage;
  /** Non-secret env required to boot buildconfig + open Couch. */
  environment: Record<string, string>;
  /** Secrets Manager-backed secrets (Couch + KEY_SOURCE dependencies). */
  secrets: Record<string, ecs.Secret>;
  /** ARN of the JWT private key secret (task role grantRead). */
  privateKeySecretArn: string;
  /** Map-layer bucket. Granted to workers only, not the manager. */
  mapAssetBucket: s3.IBucket;
  /** spatialCapacity block from stack config. */
  config: SpatialCapacityConfig;
}

/**
 * Builds the capacity-manager service and the worker task definition.
 */
export class FaimsSpatialCapacity extends Construct {
  /** Drain-worker task definition. There is no ECS service for it. */
  public readonly workerTaskDefinition: ecs.FargateTaskDefinition;
  /** Always-on capacity manager task definition. */
  public readonly managerTaskDefinition: ecs.FargateTaskDefinition;
  /** Capacity manager service. desiredCount is 1. */
  public readonly managerService: ecs.FargateService;

  constructor(scope: Construct, id: string, props: FaimsSpatialCapacityProps) {
    super(scope, id);

    this.workerTaskDefinition = new ecs.FargateTaskDefinition(
      this,
      'spatial-worker-task-dfn',
      {
        cpu: props.config.cpu,
        memoryLimitMiB: props.config.memory,
        ephemeralStorageGiB: props.config.ephemeralStorageGiB,
      }
    );
    props.mapAssetBucket.grantReadWrite(this.workerTaskDefinition.taskRole);
    sm.Secret.fromSecretCompleteArn(
      this,
      'spatialWorkerPrivateKeySecret',
      props.privateKeySecretArn
    ).grantRead(this.workerTaskDefinition.taskRole);

    this.workerTaskDefinition.addContainer(SPATIAL_WORKER_CONTAINER_NAME, {
      image: props.containerImage,
      command: buildSpatialWorkerCommand(),
      environment: {
        ...props.environment,
        SPATIAL_WORKER_IDLE_EXIT_MS: `${props.config.idleExitMs}`,
      },
      secrets: props.secrets,
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: 'faims-spatial-worker',
        logRetention: logs.RetentionDays.ONE_MONTH,
      }),
    });

    const subnets = props.vpc.selectSubnets({
      subnetType: ec2.SubnetType.PUBLIC,
    }).subnets;

    this.managerTaskDefinition = new ecs.FargateTaskDefinition(
      this,
      'capacity-manager-task-dfn',
      {
        cpu: props.config.managerCpu,
        memoryLimitMiB: props.config.managerMemory,
        ephemeralStorageGiB: 21,
      }
    );
    sm.Secret.fromSecretCompleteArn(
      this,
      'capacityManagerPrivateKeySecret',
      props.privateKeySecretArn
    ).grantRead(this.managerTaskDefinition.taskRole);

    // RunTask + PassRole on the worker roles. No StopTask, no UpdateService.
    this.workerTaskDefinition.grantRun(this.managerTaskDefinition.taskRole);
    this.managerTaskDefinition.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        sid: 'ListSpatialWorkerTasks',
        actions: ['ecs:ListTasks', 'ecs:DescribeTasks'],
        resources: ['*'],
        conditions: {
          ArnEquals: {
            'ecs:cluster': props.cluster.clusterArn,
          },
        },
      })
    );

    this.managerTaskDefinition.addContainer(CAPACITY_MANAGER_CONTAINER_NAME, {
      image: props.containerImage,
      command: buildCapacityManagerCommand(),
      environment: {
        ...props.environment,
        CAPACITY_PROVIDER: 'ECS',
        CAPACITY_MAX: `${props.config.maxCapacity}`,
        CAPACITY_RECONCILE_MS: `${props.config.reconcileMs}`,
        CAPACITY_ECS_CLUSTER: props.cluster.clusterArn,
        CAPACITY_ECS_WORKER_TASK_DEFINITION:
          this.workerTaskDefinition.taskDefinitionArn,
        CAPACITY_ECS_WORKER_TASK_FAMILY: this.workerTaskDefinition.family,
        CAPACITY_ECS_WORKER_CONTAINER: SPATIAL_WORKER_CONTAINER_NAME,
        CAPACITY_ECS_SUBNETS: subnets.map(subnet => subnet.subnetId).join(','),
        CAPACITY_ECS_SECURITY_GROUPS: props.securityGroups
          .map(group => group.securityGroupId)
          .join(','),
        CAPACITY_ECS_ASSIGN_PUBLIC_IP: 'ENABLED',
      },
      secrets: props.secrets,
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: 'faims-capacity-manager',
        logRetention: logs.RetentionDays.ONE_MONTH,
      }),
    });

    this.managerService = new ecs.FargateService(
      this,
      'capacity-manager-service',
      {
        cluster: props.cluster,
        taskDefinition: this.managerTaskDefinition,
        desiredCount: 1,
        securityGroups: props.securityGroups,
        assignPublicIp: true,
        vpcSubnets: {subnetType: ec2.SubnetType.PUBLIC},
        circuitBreaker: {enable: true, rollback: true},
        minHealthyPercent: 0,
      }
    );
    // Lock the service at one task. Scaling the manager does not help;
    // it only reconciles the queue.
    this.managerService.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 1,
    });
  }
}
