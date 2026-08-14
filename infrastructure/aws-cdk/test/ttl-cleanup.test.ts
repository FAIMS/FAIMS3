/**
 * Unit tests for TTL cleanup CDK helpers and synthesised resources.
 */
import * as cdk from 'aws-cdk-lib';
import {Match, Template} from 'aws-cdk-lib/assertions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as sm from 'aws-cdk-lib/aws-secretsmanager';
import * as sns from 'aws-cdk-lib/aws-sns';
import {
  buildTtlCleanupCommand,
  FaimsTtlCleanup,
  TTL_CLEANUP_CONTAINER_NAME,
} from '../lib/components/ttl-cleanup';

describe('buildTtlCleanupCommand', () => {
  it('uses compiled script path relative to NODE_RUN_DIR (not API server CMD)', () => {
    expect(buildTtlCleanupCommand({})).toEqual([
      'node',
      'scripts/ttlCleanup.js',
    ]);
  });

  it('appends dry-run, compact, include-longlived, and delete-exhausted-invites when set', () => {
    expect(
      buildTtlCleanupCommand({
        dryRun: true,
        compact: true,
        includeLongLived: true,
        deleteExhaustedInvites: true,
      })
    ).toEqual([
      'node',
      'scripts/ttlCleanup.js',
      '--dry-run',
      '--compact',
      '--include-longlived',
      '--delete-exhausted-invites',
    ]);
  });

  it('omits delete-exhausted-invites by default (exhausted unexpired invites kept)', () => {
    expect(
      buildTtlCleanupCommand({
        dryRun: true,
        deleteExhaustedInvites: false,
      })
    ).toEqual(['node', 'scripts/ttlCleanup.js', '--dry-run']);
  });
});

describe('FaimsTtlCleanup synth', () => {
  it('creates Scheduler + task definition with ttlCleanup command override', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TtlCleanupTestStack', {
      env: {account: '123456789012', region: 'ap-southeast-2'},
    });

    const vpc = new ec2.Vpc(stack, 'vpc', {maxAzs: 2, natGateways: 0});
    const cluster = new ecs.Cluster(stack, 'cluster', {vpc});
    const sg = new ec2.SecurityGroup(stack, 'sg', {vpc});
    const couchSecret = new sm.Secret(stack, 'couch', {
      secretObjectValue: {
        username: cdk.SecretValue.unsafePlainText('admin'),
        password: cdk.SecretValue.unsafePlainText('password'),
      },
    });
    const privateKeyArn =
      'arn:aws:secretsmanager:ap-southeast-2:123456789012:secret:private-key-AbCdEf';
    const alarmTopic = new sns.Topic(stack, 'ops-alarms', {
      displayName: 'CouchDB Alarms',
    });

    new FaimsTtlCleanup(stack, 'ttl-cleanup', {
      vpc,
      cluster,
      securityGroups: [sg],
      containerImage: ecs.ContainerImage.fromRegistry(
        'ghcr.io/faims/faims3-api:latest'
      ),
      environment: {
        COUCHDB_INTERNAL_URL: 'https://couch.example.com',
        COUCHDB_PUBLIC_URL: 'https://couch.example.com',
        KEY_SOURCE: 'AWS_SM',
        AWS_SECRET_KEY_ARN: privateKeyArn,
        EMAIL_SERVICE_TYPE: 'MOCK',
        REDIRECT_WHITELIST: 'https://conductor.example.com',
      },
      secrets: {
        COUCHDB_USER: ecs.Secret.fromSecretsManager(couchSecret, 'username'),
        COUCHDB_PASSWORD: ecs.Secret.fromSecretsManager(
          couchSecret,
          'password'
        ),
      },
      privateKeySecretArn: privateKeyArn,
      alarmTopic,
      config: {
        enabled: true,
        scheduleExpression: 'cron(0 2 * * ? *)',
        scheduleExpressionTimezone: 'Australia/Sydney',
        dryRun: true,
        compact: false,
        includeLongLived: false,
        deleteExhaustedInvites: false,
        cpu: 256,
        memory: 512,
      },
    });

    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::Scheduler::Schedule', {
      ScheduleExpression: 'cron(0 2 * * ? *)',
      ScheduleExpressionTimezone: 'Australia/Sydney',
      FlexibleTimeWindow: {Mode: 'OFF'},
      Target: {
        EcsParameters: Match.objectLike({
          TaskCount: 1,
          LaunchType: 'FARGATE',
        }),
      },
    });

    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      Cpu: '256',
      Memory: '512',
      ContainerDefinitions: Match.arrayWith([
        Match.objectLike({
          Name: TTL_CLEANUP_CONTAINER_NAME,
          Command: ['node', 'scripts/ttlCleanup.js', '--dry-run'],
          Image: 'ghcr.io/faims/faims3-api:latest',
          LogConfiguration: Match.objectLike({
            Options: Match.objectLike({
              'awslogs-stream-prefix': 'faims-ttl-cleanup',
            }),
          }),
        }),
      ]),
    });

    // Must not be the API server CMD alone
    const taskDefs = template.findResources('AWS::ECS::TaskDefinition');
    for (const resource of Object.values(taskDefs)) {
      const containers = resource.Properties.ContainerDefinitions as Array<{
        Command?: string[];
      }>;
      for (const c of containers) {
        expect(c.Command).not.toEqual(['node', 'index.js']);
      }
    }

    template.hasResourceProperties('AWS::Events::Rule', {
      Description:
        'Notify SNS when the FAIMS TTL cleanup ECS task exits with a non-zero code',
      EventPattern: {
        source: ['aws.ecs'],
        'detail-type': ['ECS Task State Change'],
        detail: Match.objectLike({
          lastStatus: ['STOPPED'],
          containers: {
            name: [TTL_CLEANUP_CONTAINER_NAME],
            // CDK wraps numeric anything-but as [[{ "anything-but": [0] }]]
            exitCode: [[{'anything-but': [0]}]],
          },
        }),
      },
      Targets: Match.arrayWith([
        Match.objectLike({
          InputTransformer: Match.objectLike({
            InputTemplate: Match.stringLikeRegexp(
              'ALERT: FAIMS TTL cleanup failed \\(non-zero exit\\)'
            ),
          }),
        }),
      ]),
    });
  });
});
