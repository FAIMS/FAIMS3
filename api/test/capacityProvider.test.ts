// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it, vi} from 'vitest';
import {
  CapacityProviderType,
  EcsCapacityProvider,
  FixedCapacityProvider,
  MockCapacityProvider,
  createCapacityProvider,
  type EcsControlPlane,
} from '../src/services/capacityProvider';

const ecsConfig = {
  cluster: 'cluster-1',
  taskDefinition: 'arn:aws:ecs:ap-southeast-2:1:task-definition/spatial:3',
  taskFamily: 'spatial',
  containerName: 'spatial-worker-container',
  subnets: ['subnet-a'],
  securityGroups: ['sg-a'],
  assignPublicIp: 'ENABLED' as const,
};

describe('capacity providers', () => {
  it('FIXED reports the configured pool and does not change it', async () => {
    const provider = new FixedCapacityProvider({replicas: 2});
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(await provider.getCapacity()).toEqual({running: 2, pending: 0});
    await provider.ensureCapacity(5);
    expect(await provider.getCapacity()).toEqual({running: 2, pending: 0});
    log.mockRestore();
  });

  it('MOCK records ensureCapacity and never scales down', async () => {
    const provider = new MockCapacityProvider(1, 0);
    await provider.ensureCapacity(3);
    expect(provider.ensured).toEqual([3]);
    expect(await provider.getCapacity()).toEqual({running: 3, pending: 0});
    await provider.ensureCapacity(1);
    expect(provider.ensured).toEqual([3, 1]);
    expect(provider.running).toBe(3);
  });

  it('ECS RunTask covers only the gap and never stops tasks', async () => {
    const runTask = vi.fn(
      async (_input: Parameters<EcsControlPlane['runTask']>[0]) => ({
        failureReasons: [] as string[],
      })
    );
    const listTasks = vi.fn(
      async (input: Parameters<EcsControlPlane['listTasks']>[0]) => {
        if (input.desiredStatus === 'RUNNING') {
          return {taskArns: ['arn:task/1']};
        }
        return {taskArns: ['arn:task/pending']};
      }
    );
    const ecs: EcsControlPlane = {listTasks, runTask};
    const provider = new EcsCapacityProvider({config: ecsConfig, ecs});

    expect(await provider.getCapacity()).toEqual({running: 1, pending: 1});
    await provider.ensureCapacity(4);
    expect(runTask).toHaveBeenCalledOnce();
    expect(runTask.mock.calls[0][0]).toMatchObject({
      cluster: 'cluster-1',
      taskDefinition: ecsConfig.taskDefinition,
      count: 2,
      containerName: 'spatial-worker-container',
      assignPublicIp: 'ENABLED',
    });

    runTask.mockClear();
    await provider.ensureCapacity(2);
    expect(runTask).not.toHaveBeenCalled();
    expect(
      listTasks.mock.calls.every(call => call[0].family === 'spatial')
    ).toBe(true);
  });

  it('createCapacityProvider rejects ECS without config', () => {
    expect(() =>
      createCapacityProvider({serviceType: CapacityProviderType.ECS})
    ).toThrow(/ECS capacity configuration/);
    expect(
      createCapacityProvider({serviceType: CapacityProviderType.FIXED})
    ).toBeInstanceOf(FixedCapacityProvider);
    expect(
      createCapacityProvider({serviceType: CapacityProviderType.MOCK})
    ).toBeInstanceOf(MockCapacityProvider);
  });
});
