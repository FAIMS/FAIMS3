// SPDX-License-Identifier: Apache-2.0
import {ECSClient, ListTasksCommand, RunTaskCommand} from '@aws-sdk/client-ecs';

/**
 * Where the capacity manager asks for spatial workers.
 *
 * `ECS` starts Fargate tasks (they exit themselves when idle).
 * `FIXED` is an always-on pool (compose / on-prem); ensure is a no-op.
 * `MOCK` records calls in memory for tests.
 * A DigitalOcean provider can be added later without changing the manager.
 */
export enum CapacityProviderType {
  ECS = 'ECS',
  FIXED = 'FIXED',
  MOCK = 'MOCK',
}

/** Workers that exist or are still starting. The manager must not stop them. */
export type CapacitySnapshot = {
  running: number;
  pending: number;
};

/**
 * Adds worker capacity. Implementations must not stop or replace in-flight
 * workers — idle exit is the worker's job.
 */
export interface ICapacityProvider {
  getCapacity(): Promise<CapacitySnapshot>;
  /**
   * Ensure at least `desired` workers exist. A no-op when that many are
   * already running or pending. Must not scale down.
   */
  ensureCapacity(desired: number): Promise<void>;
}

/**
 * Abstract base for capacity providers.
 */
export abstract class BaseCapacityProvider implements ICapacityProvider {
  abstract getCapacity(): Promise<CapacitySnapshot>;
  abstract ensureCapacity(desired: number): Promise<void>;
}

/** Always-on pool. `ensureCapacity` does not start or stop anything. */
export interface FixedCapacityProviderConfig {
  /** Replica count reported by {@link FixedCapacityProvider.getCapacity}. */
  replicas: number;
}

/**
 * Fixed pool (docker compose, on-prem). The workers are already running.
 */
export class FixedCapacityProvider extends BaseCapacityProvider {
  private readonly replicas: number;

  constructor({replicas}: FixedCapacityProviderConfig) {
    super();
    this.replicas = replicas;
  }

  /** Report the configured replica count as already running. */
  async getCapacity(): Promise<CapacitySnapshot> {
    return {running: this.replicas, pending: 0};
  }

  /** Log the request; a FIXED pool is already running. */
  async ensureCapacity(desired: number): Promise<void> {
    console.log(
      `[capacity] FIXED pool (${this.replicas} running); not changing capacity (wanted ${desired})`
    );
  }
}

/**
 * In-memory provider for tests. `ensureCapacity` raises `running` up to
 * `desired` and never lowers it.
 */
export class MockCapacityProvider extends BaseCapacityProvider {
  /** Every `ensureCapacity` argument, including no-op calls. */
  readonly ensured: number[] = [];
  running: number;
  pending: number;

  constructor(running = 0, pending = 0) {
    super();
    this.running = running;
    this.pending = pending;
  }

  /** Current in-memory running/pending counts. */
  async getCapacity(): Promise<CapacitySnapshot> {
    return {running: this.running, pending: this.pending};
  }

  /** Raise `running` up to `desired`; never lowers it. */
  async ensureCapacity(desired: number): Promise<void> {
    this.ensured.push(desired);
    const have = this.running + this.pending;
    if (desired > have) {
      this.running += desired - have;
    }
  }
}

/** ECS RunTask settings. Scale-down is worker idle-exit, not StopTask. */
export interface EcsCapacityProviderConfig {
  /** Cluster name or ARN. */
  cluster: string;
  /** Task definition ARN (family:revision) passed to RunTask. */
  taskDefinition: string;
  /** Task definition family used to list running and pending tasks. */
  taskFamily: string;
  /** Container name inside the task definition (RunTask override). */
  containerName: string;
  subnets: string[];
  securityGroups: string[];
  assignPublicIp: 'ENABLED' | 'DISABLED';
}

/**
 * Narrow ECS surface so tests can fake ListTasks / RunTask.
 * There is no stop or update-service method on purpose.
 */
export interface EcsControlPlane {
  listTasks(input: {
    cluster: string;
    family: string;
    desiredStatus: 'RUNNING' | 'PENDING';
    nextToken?: string;
  }): Promise<{taskArns?: string[]; nextToken?: string}>;

  runTask(input: {
    cluster: string;
    taskDefinition: string;
    count: number;
    containerName: string;
    subnets: string[];
    securityGroups: string[];
    assignPublicIp: 'ENABLED' | 'DISABLED';
  }): Promise<{failureReasons: string[]}>;
}

/** ECS allows at most 10 tasks per RunTask call. */
const ECS_RUN_TASK_MAX_COUNT = 10;

/**
 * AWS SDK adapter. Starts drain workers with RunTask. Does not call
 * StopTask or UpdateService.
 */
export class AwsEcsControlPlane implements EcsControlPlane {
  private readonly client: ECSClient;

  constructor(client: ECSClient = new ECSClient({})) {
    this.client = client;
  }

  async listTasks(input: {
    cluster: string;
    family: string;
    desiredStatus: 'RUNNING' | 'PENDING';
    nextToken?: string;
  }): Promise<{taskArns?: string[]; nextToken?: string}> {
    const page = await this.client.send(
      new ListTasksCommand({
        cluster: input.cluster,
        family: input.family,
        desiredStatus: input.desiredStatus,
        nextToken: input.nextToken,
      })
    );
    return {taskArns: page.taskArns, nextToken: page.nextToken};
  }

  async runTask(input: {
    cluster: string;
    taskDefinition: string;
    count: number;
    containerName: string;
    subnets: string[];
    securityGroups: string[];
    assignPublicIp: 'ENABLED' | 'DISABLED';
  }): Promise<{failureReasons: string[]}> {
    const result = await this.client.send(
      new RunTaskCommand({
        cluster: input.cluster,
        taskDefinition: input.taskDefinition,
        count: input.count,
        launchType: 'FARGATE',
        networkConfiguration: {
          awsvpcConfiguration: {
            subnets: input.subnets,
            securityGroups: input.securityGroups,
            assignPublicIp: input.assignPublicIp,
          },
        },
        overrides: {
          containerOverrides: [
            {
              name: input.containerName,
              command: ['node', 'scripts/spatialWorker.js', '--poll'],
            },
          ],
        },
      })
    );
    return {
      failureReasons: (result.failures ?? [])
        .map(failure => failure.reason || failure.arn || 'RunTask failed')
        .filter((reason): reason is string => reason.length > 0),
    };
  }
}

/**
 * Starts Fargate drain workers when the queue is deeper than the tasks
 * already running or pending. Never stops a task.
 */
export class EcsCapacityProvider extends BaseCapacityProvider {
  private readonly config: EcsCapacityProviderConfig;
  private readonly ecs: EcsControlPlane;

  constructor({
    config,
    ecs = new AwsEcsControlPlane(),
  }: {
    config: EcsCapacityProviderConfig;
    ecs?: EcsControlPlane;
  }) {
    super();
    this.config = config;
    this.ecs = ecs;
  }

  /** Count RUNNING and PENDING tasks for the worker family. */
  async getCapacity(): Promise<CapacitySnapshot> {
    const [running, pending] = await Promise.all([
      this.countTasks('RUNNING'),
      this.countTasks('PENDING'),
    ]);
    return {running, pending};
  }

  /** RunTask enough new workers to close the gap; never stops existing ones. */
  async ensureCapacity(desired: number): Promise<void> {
    const snapshot = await this.getCapacity();
    let gap = desired - snapshot.running - snapshot.pending;
    if (gap <= 0) {
      return;
    }
    while (gap > 0) {
      const count = Math.min(gap, ECS_RUN_TASK_MAX_COUNT);
      const result = await this.ecs.runTask({
        cluster: this.config.cluster,
        taskDefinition: this.config.taskDefinition,
        count,
        containerName: this.config.containerName,
        subnets: this.config.subnets,
        securityGroups: this.config.securityGroups,
        assignPublicIp: this.config.assignPublicIp,
      });
      if (result.failureReasons.length > 0) {
        throw new Error(
          `ECS RunTask failed: ${result.failureReasons.join('; ')}`
        );
      }
      gap -= count;
    }
  }

  /** Paginated ListTasks count for one desired status. */
  private async countTasks(
    desiredStatus: 'RUNNING' | 'PENDING'
  ): Promise<number> {
    let total = 0;
    let nextToken: string | undefined;
    do {
      const page = await this.ecs.listTasks({
        cluster: this.config.cluster,
        family: this.config.taskFamily,
        desiredStatus,
        nextToken,
      });
      total += page.taskArns?.length ?? 0;
      nextToken = page.nextToken;
    } while (nextToken);
    return total;
  }
}

export interface CreateCapacityProviderParams {
  serviceType: CapacityProviderType;
  /** Used when `serviceType` is FIXED. Defaults to 1. */
  fixedReplicas?: number;
  /** Required when `serviceType` is ECS. */
  ecs?: EcsCapacityProviderConfig;
  /** Test double for the ECS client. Ignored unless type is ECS. */
  ecsClient?: EcsControlPlane;
}

/**
 * Creates the capacity provider selected by env / the caller.
 * @throws Error if ECS is selected without config, or the type is unknown.
 */
export function createCapacityProvider({
  serviceType,
  fixedReplicas = 1,
  ecs,
  ecsClient,
}: CreateCapacityProviderParams): ICapacityProvider {
  switch (serviceType) {
    case CapacityProviderType.ECS:
      if (!ecs) {
        throw new Error(
          'ECS capacity configuration is required when CAPACITY_PROVIDER is ECS'
        );
      }
      return new EcsCapacityProvider({
        config: ecs,
        ...(ecsClient ? {ecs: ecsClient} : {}),
      });
    case CapacityProviderType.FIXED:
      return new FixedCapacityProvider({replicas: fixedReplicas});
    case CapacityProviderType.MOCK:
      return new MockCapacityProvider();
    default:
      throw new Error(`Unsupported capacity provider type: ${serviceType}`);
  }
}
