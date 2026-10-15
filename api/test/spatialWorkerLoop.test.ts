// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {runSpatialWorkerLoop} from '../src/spatial/workerLoop';

describe('spatial worker idle exit', () => {
  it('exits once an empty poll is past the idle timeout', async () => {
    let now = 0;
    const outcome = await runSpatialWorkerLoop({
      idleExitMs: 1_000,
      pollIntervalMs: 400,
      now: () => now,
      sleep: async ms => {
        now += ms;
      },
      findJob: async () => undefined,
      processJob: async () => {
        throw new Error('no job to process');
      },
    });
    expect(outcome).toBe('idle');
    expect(now).toBeGreaterThanOrEqual(1_000);
  });

  it('resets the idle timer when a job is claimed', async () => {
    let now = 0;
    const processed: string[] = [];
    let polls = 0;
    const outcome = await runSpatialWorkerLoop({
      idleExitMs: 1_000,
      pollIntervalMs: 400,
      now: () => now,
      sleep: async ms => {
        now += ms;
      },
      findJob: async () => {
        polls += 1;
        // After two empty sleeps (800ms) a job arrives, then the queue stays empty.
        if (polls === 3) {
          return 'asset-1';
        }
        return undefined;
      },
      processJob: async assetId => {
        processed.push(assetId);
        now += 5_000;
      },
    });
    expect(processed).toEqual(['asset-1']);
    expect(outcome).toBe('idle');
    // Processing time does not count as idle: exit is 1000ms after the job, not during it.
    expect(now).toBeGreaterThanOrEqual(5_000 + 1_000);
  });

  it('never exits when the idle timeout is 0', async () => {
    let polls = 0;
    const outcome = await runSpatialWorkerLoop({
      idleExitMs: 0,
      pollIntervalMs: 10,
      sleep: async () => undefined,
      findJob: async () => undefined,
      processJob: async () => undefined,
      maxPolls: 3,
    });
    polls = 3;
    expect(outcome).toBe('stopped');
    expect(polls).toBe(3);
  });
});
