// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {
  MAP_ASSET_ORIGINAL_STORE_SWEEP_INTERVAL_MS,
  runOriginalStoreSweepLoop,
} from '../src/couchdb/mapAssets/originalStoreSweep';

describe('original store sweep loop', () => {
  it('uses a one-minute module interval', () => {
    expect(MAP_ASSET_ORIGINAL_STORE_SWEEP_INTERVAL_MS).toBe(60 * 1000);
  });

  it('sweeps then sleeps the configured interval', async () => {
    const sweeps: number[] = [];
    const sleeps: number[] = [];
    const outcome = await runOriginalStoreSweepLoop({
      intervalMs: 400,
      maxPolls: 2,
      sleep: async ms => {
        sleeps.push(ms);
      },
      sweep: async () => {
        sweeps.push(sleeps.length);
      },
    });
    expect(outcome).toBe('stopped');
    expect(sweeps).toEqual([0, 1]);
    expect(sleeps).toEqual([400]);
  });

  it('treats a thrown sweep as empty and keeps running', async () => {
    const pollErrors: unknown[] = [];
    let polls = 0;
    const outcome = await runOriginalStoreSweepLoop({
      intervalMs: 10,
      sleep: async () => undefined,
      sweep: async () => {
        polls += 1;
        if (polls === 1) {
          throw new Error('Couch unavailable');
        }
      },
      onPollError: error => {
        pollErrors.push(error);
      },
      maxPolls: 3,
    });
    expect(outcome).toBe('stopped');
    expect(polls).toBe(3);
    expect(pollErrors).toHaveLength(1);
    expect((pollErrors[0] as Error).message).toBe('Couch unavailable');
  });
});
