/**
 * Unit tests for the spatial capacity manager service and worker task definition.
 */
import * as cdk from 'aws-cdk-lib';
import {Match, Template} from 'aws-cdk-lib/assertions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import {
  buildCapacityManagerCommand,
  buildSpatialWorkerCommand,
  CAPACITY_MANAGER_CONTAINER_NAME,
  FaimsSpatialCapacity,
  spatialWorkerPerformanceEnv,
  SPATIAL_WORKER_CONTAINER_NAME,
} from '../lib/components/spatial-capacity';

describe('spatial worker commands', () => {
  it('runs the compiled drain worker and capacity manager, not the API server', () => {
    expect(buildSpatialWorkerCommand()).toEqual([
      'node',
      'scripts/spatialWorker.js',
      '--poll',
    ]);
    expect(buildCapacityManagerCommand()).toEqual([
      'node',
      'scripts/capacityManager.js',
    ]);
  });
});

describe('FaimsSpatialCapacity synth', () => {
  it('keeps one manager service and a worker task definition with no worker service', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'SpatialCapacityTestStack', {
      env: {account: '123456789012', region: 'ap-southeast-2'},
    });
    const vpc = new ec2.Vpc(stack, 'vpc', {maxAzs: 2, natGateways: 0});
    const cluster = new ecs.Cluster(stack, 'cluster', {vpc});
    const securityGroup = new ec2.SecurityGroup(stack, 'sg', {vpc});
    const bucket = new s3.Bucket(stack, 'maps');

    new FaimsSpatialCapacity(stack, 'spatial-capacity', {
      vpc,
      cluster,
      securityGroups: [securityGroup],
      containerImage: ecs.ContainerImage.fromRegistry(
        'ghcr.io/faims/faims3-api:latest'
      ),
      environment: {PROFILE_NAME: 'default'},
      secrets: {},
      privateKeySecretArn:
        'arn:aws:secretsmanager:ap-southeast-2:123456789012:secret:private-key-AbCdEf',
      mapAssetBucket: bucket,
      config: {
        maxCapacity: 4,
        scaleThresholds: [3, 8, 16, 32],
        reconcileMs: 15_000,
        starvationMs: 300_000,
        idleExitMs: 60_000,
        cpu: 1024,
        memory: 2048,
        ephemeralStorageGiB: 80,
        managerCpu: 256,
        managerMemory: 512,
        gdalNumThreads: 'ALL_CPUS',
        gdalCacheMaxMb: 256,
        gdalWarpMemoryMb: 256,
        gdalWarpMulti: true,
      },
    });

    const template = Template.fromStack(stack);

    template.resourceCountIs('AWS::ECS::Service', 1);
    template.hasResourceProperties('AWS::ECS::Service', {
      DesiredCount: 1,
      LaunchType: 'FARGATE',
    });

    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      Cpu: '1024',
      Memory: '2048',
      EphemeralStorage: {SizeInGiB: 80},
      ContainerDefinitions: Match.arrayWith([
        Match.objectLike({
          Name: SPATIAL_WORKER_CONTAINER_NAME,
          Command: ['node', 'scripts/spatialWorker.js', '--poll'],
          Environment: Match.arrayWith([
            Match.objectLike({
              Name: 'SPATIAL_WORKER_IDLE_EXIT_MS',
              Value: '60000',
            }),
            Match.objectLike({
              Name: 'GDAL_NUM_THREADS',
              Value: 'ALL_CPUS',
            }),
            Match.objectLike({Name: 'GDAL_CACHEMAX', Value: '256'}),
            Match.objectLike({Name: 'GDAL_WARP_MEMORY_MB', Value: '256'}),
            Match.objectLike({Name: 'GDAL_WARP_MULTI', Value: 'true'}),
          ]),
        }),
      ]),
    });

    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      Cpu: '256',
      Memory: '512',
      ContainerDefinitions: Match.arrayWith([
        Match.objectLike({
          Name: CAPACITY_MANAGER_CONTAINER_NAME,
          Command: ['node', 'scripts/capacityManager.js'],
          Environment: Match.arrayWith([
            Match.objectLike({Name: 'CAPACITY_PROVIDER', Value: 'ECS'}),
            Match.objectLike({Name: 'CAPACITY_MAX', Value: '4'}),
            Match.objectLike({
              Name: 'CAPACITY_SCALE_THRESHOLDS',
              Value: '3,8,16,32',
            }),
            Match.objectLike({
              Name: 'CAPACITY_STARVATION_MS',
              Value: '300000',
            }),
            Match.objectLike({
              Name: 'CAPACITY_SCALE_IN_COOLDOWN_MS',
              Value: '600000',
            }),
          ]),
        }),
      ]),
    });

    const policies = template.findResources('AWS::IAM::Policy');
    const statements = Object.values(policies).flatMap(resource => {
      const document = resource.Properties.PolicyDocument as {
        Statement: Array<{Action: string | string[]}>;
      };
      return document.Statement ?? [];
    });
    const actions = statements.flatMap(statement =>
      Array.isArray(statement.Action) ? statement.Action : [statement.Action]
    );
    expect(actions).toEqual(
      expect.arrayContaining(['ecs:RunTask', 'ecs:ListTasks'])
    );
    expect(actions).not.toContain('ecs:StopTask');
    expect(actions).not.toContain('ecs:UpdateService');

    const services = template.findResources('AWS::ECS::Service');
    expect(Object.keys(services)).toHaveLength(1);
  });
});

describe('spatialWorkerPerformanceEnv', () => {
  const base = {
    maxCapacity: 4,
    scaleThresholds: [3, 8, 16, 32],
    reconcileMs: 15_000,
    starvationMs: 300_000,
    idleExitMs: 60_000,
    cpu: 8192,
    memory: 32768,
    ephemeralStorageGiB: 80,
    managerCpu: 256,
    managerMemory: 512,
    gdalNumThreads: 'ALL_CPUS' as const,
    gdalCacheMaxMb: 2048,
    gdalWarpMemoryMb: 1024,
    gdalWarpMulti: true,
  };

  it('omits TIPPECANOE_MAX_THREADS unless set', () => {
    expect(spatialWorkerPerformanceEnv(base)).not.toHaveProperty(
      'TIPPECANOE_MAX_THREADS'
    );
  });

  it('passes a thread cap when configured', () => {
    expect(
      spatialWorkerPerformanceEnv({...base, tippecanoeMaxThreads: 8})
    ).toMatchObject({
      GDAL_NUM_THREADS: 'ALL_CPUS',
      GDAL_CACHEMAX: '2048',
      GDAL_WARP_MEMORY_MB: '1024',
      TIPPECANOE_MAX_THREADS: '8',
    });
  });
});
