/**
 * Scheduled one-shot Fargate task for Conductor TTL cleanup of ephemeral
 * CouchDB auth/invite documents.
 *
 * Uses EventBridge Scheduler → ecs:RunTask (taskCount: 1) so Conductor
 * service scaling does not multiply cleanup executions. Reuses the Conductor
 * image with a command override (not the API server CMD).
 *
 * See docs/developer/docs/source/markdown/TtlCleanup.md.
 */

import {ArnFormat, Stack, TimeZone} from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as events from 'aws-cdk-lib/aws-events';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import * as schedulerTargets from 'aws-cdk-lib/aws-scheduler-targets';
import * as sm from 'aws-cdk-lib/aws-secretsmanager';
import * as sns from 'aws-cdk-lib/aws-sns';
import {Construct} from 'constructs';
import {TtlCleanupConfig} from '../config';

/** Container name used in the task definition and failure event filter. */
export const TTL_CLEANUP_CONTAINER_NAME = 'ttl-cleanup-container';

/**
 * Properties for the FaimsTtlCleanup construct
 */
export interface FaimsTtlCleanupProps {
  /** VPC used by Conductor / Couch networking */
  vpc: ec2.IVpc;
  /** Conductor ECS cluster to RunTask into */
  cluster: ecs.ICluster;
  /** Security groups with Couch egress equivalent to Conductor */
  securityGroups: ec2.ISecurityGroup[];
  /** Same Docker image as Conductor */
  containerImage: ecs.ContainerImage;
  /** Non-secret env required to boot buildconfig + open Couch */
  environment: Record<string, string>;
  /** Secrets Manager-backed secrets (Couch + KEY_SOURCE dependencies) */
  secrets: Record<string, ecs.Secret>;
  /** ARN of the JWT private key secret (task role grantRead) */
  privateKeySecretArn: string;
  /** ttlCleanup block from stack config */
  config: TtlCleanupConfig;
  /**
   * Ops SNS topic for non-zero exit alerts (typically the CouchDB alarm topic
   * that already has an email subscription).
   */
  alarmTopic: sns.ITopic;
}

/**
 * Builds the container command for the compiled TTL cleanup script.
 *
 * Production image WORKDIR is `/app/api/build/src` (NODE_RUN_DIR), so the
 * entry is `scripts/ttlCleanup.js` relative to that directory — not the
 * default `node index.js` API server CMD.
 */
export const buildTtlCleanupCommand = (
  config: Partial<
    Pick<
      TtlCleanupConfig,
      'dryRun' | 'compact' | 'includeLongLived' | 'deleteExhaustedInvites'
    >
  >
): string[] => {
  const command = ['node', 'scripts/ttlCleanup.js'];
  if (config.dryRun) {
    command.push('--dry-run');
  }
  if (config.compact) {
    command.push('--compact');
  }
  if (config.includeLongLived) {
    command.push('--include-longlived');
  }
  if (config.deleteExhaustedInvites) {
    command.push('--delete-exhausted-invites');
  }
  return command;
};

/**
 * Plain-text SNS body for a failed TTL cleanup task (EventBridge fields filled
 * at invoke time). Exported for unit tests.
 */
export const buildTtlCleanupFailureMessage = (): events.RuleTargetInput => {
  const clusterArn = events.EventField.fromPath('$.detail.clusterArn');
  const taskArn = events.EventField.fromPath('$.detail.taskArn');
  const taskDefinitionArn = events.EventField.fromPath(
    '$.detail.taskDefinitionArn'
  );
  const stopCode = events.EventField.fromPath('$.detail.stopCode');
  const stoppedReason = events.EventField.fromPath('$.detail.stoppedReason');
  const startedAt = events.EventField.fromPath('$.detail.startedAt');
  const stoppedAt = events.EventField.fromPath('$.detail.stoppedAt');

  return events.RuleTargetInput.fromText(
    [
      'ALERT: FAIMS TTL cleanup failed (non-zero exit)',
      '',
      'The scheduled one-shot ECS task that purges expired ephemeral CouchDB',
      'auth/invite documents exited with a non-zero exit code.',
      '',
      'Action: inspect CloudWatch Logs (stream prefix faims-ttl-cleanup),',
      'confirm CouchDB connectivity/credentials, then re-run the task or wait',
      'for the next schedule.',
      '',
      `Cluster: ${clusterArn}`,
      `Task: ${taskArn}`,
      `Task definition: ${taskDefinitionArn}`,
      `Stop code: ${stopCode}`,
      `Stopped reason: ${stoppedReason}`,
      `Started at: ${startedAt}`,
      `Stopped at: ${stoppedAt}`,
    ].join('\n')
  );
};

/**
 * EventBridge Scheduler + Fargate task definition for TTL cleanup.
 */
export class FaimsTtlCleanup extends Construct {
  /** Task definition used by the schedule (and manual ecs run-task). */
  public readonly taskDefinition: ecs.FargateTaskDefinition;
  /** EventBridge Scheduler schedule. */
  public readonly schedule: scheduler.Schedule;
  /** Rule that notifies SNS when the cleanup container exits non-zero. */
  public readonly failureRule: events.Rule;

  constructor(scope: Construct, id: string, props: FaimsTtlCleanupProps) {
    super(scope, id);

    if (!props.config.enabled) {
      throw new Error(
        'FaimsTtlCleanup should only be instantiated when ttlCleanup.enabled is true'
      );
    }

    this.taskDefinition = new ecs.FargateTaskDefinition(
      this,
      'ttl-cleanup-task-dfn',
      {
        cpu: props.config.cpu,
        memoryLimitMiB: props.config.memory,
        ephemeralStorageGiB: 21,
      }
    );

    const command = buildTtlCleanupCommand(props.config);

    this.taskDefinition.addContainer(TTL_CLEANUP_CONTAINER_NAME, {
      image: props.containerImage,
      command,
      environment: props.environment,
      secrets: props.secrets,
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: 'faims-ttl-cleanup',
        logRetention: logs.RetentionDays.ONE_MONTH,
      }),
    });

    // Signing keys via AWS Secrets Manager (KEY_SOURCE=AWS_SM)
    sm.Secret.fromSecretCompleteArn(
      this,
      'ttlCleanupPrivateKeySecret',
      props.privateKeySecretArn
    ).grantRead(this.taskDefinition.taskRole);

    this.schedule = new scheduler.Schedule(this, 'ttl-cleanup-schedule', {
      description:
        'Daily one-shot FAIMS TTL cleanup of expired ephemeral CouchDB docs',
      // Cron hours are local to scheduleExpressionTimezone (default Australia/Sydney).
      schedule: scheduler.ScheduleExpression.expression(
        props.config.scheduleExpression,
        TimeZone.of(props.config.scheduleExpressionTimezone)
      ),
      // Default TimeWindow.off() — avoid drifting overlaps with daily cadence.
      timeWindow: scheduler.TimeWindow.off(),
      target: new schedulerTargets.EcsRunFargateTask(props.cluster, {
        taskDefinition: this.taskDefinition,
        taskCount: 1,
        securityGroups: props.securityGroups,
        vpcSubnets: {subnetType: ec2.SubnetType.PUBLIC},
        assignPublicIp: true,
      }),
    });

    // Non-zero exit → ops SNS (same topic as CouchDB alarms when wired).
    const stack = Stack.of(this);
    // Prefix matches all revisions: ...:task-definition/<family>:<rev>
    const taskDefinitionArnPrefix = stack.formatArn({
      service: 'ecs',
      resource: 'task-definition',
      resourceName: this.taskDefinition.family,
      arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
    });

    this.failureRule = new events.Rule(this, 'ttl-cleanup-failure-rule', {
      description:
        'Notify SNS when the FAIMS TTL cleanup ECS task exits with a non-zero code',
      eventPattern: {
        source: ['aws.ecs'],
        detailType: ['ECS Task State Change'],
        detail: {
          lastStatus: ['STOPPED'],
          clusterArn: [props.cluster.clusterArn],
          taskDefinitionArn: [{prefix: taskDefinitionArnPrefix}],
          containers: {
            name: [TTL_CLEANUP_CONTAINER_NAME],
            exitCode: [events.Match.anythingBut(0)],
          },
        },
      },
    });

    this.failureRule.addTarget(
      new eventsTargets.SnsTopic(props.alarmTopic, {
        message: buildTtlCleanupFailureMessage(),
      })
    );
  }
}
