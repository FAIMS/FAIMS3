// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {reconcileCapacity} from '../src/spatial/reconcileCapacity';
import {MockCapacityProvider} from '../src/services/capacityProvider';

describe('reconcileCapacity', () => {
  it('does nothing when the queue is empty, even if a worker is running', async () => {
    const provider = new MockCapacityProvider(1, 0);
    const result = await reconcileCapacity({
      provider,
      inFlight: 0,
      unclaimed: 0,
      max: 4,
    });
    expect(result).toEqual({needed: 0, ensured: false});
    expect(provider.ensured).toEqual([]);
    expect(provider.running).toBe(1);
  });

  it('ensures two workers when two jobs are unclaimed and nothing is running', async () => {
    const provider = new MockCapacityProvider(0, 0);
    const result = await reconcileCapacity({
      provider,
      inFlight: 0,
      unclaimed: 2,
      max: 4,
    });
    expect(result).toEqual({needed: 2, ensured: true});
    expect(provider.ensured).toEqual([2]);
    expect(provider.running).toBe(2);
  });

  it('does not call ensure when in-flight work is already covered', async () => {
    const provider = new MockCapacityProvider(1, 1);
    const result = await reconcileCapacity({
      provider,
      inFlight: 2,
      unclaimed: 0,
      max: 4,
    });
    expect(result).toEqual({needed: 2, ensured: false});
    expect(provider.ensured).toEqual([]);
  });

  it('ensures when in-flight work exceeds running and pending', async () => {
    const provider = new MockCapacityProvider(0, 0);
    const result = await reconcileCapacity({
      provider,
      inFlight: 2,
      unclaimed: 0,
      max: 4,
    });
    expect(result).toEqual({needed: 2, ensured: true});
    expect(provider.ensured).toEqual([2]);
  });

  it('caps needed at max', async () => {
    const provider = new MockCapacityProvider(0, 0);
    const result = await reconcileCapacity({
      provider,
      inFlight: 1,
      unclaimed: 10,
      max: 4,
    });
    expect(result.needed).toBe(4);
    expect(provider.ensured).toEqual([4]);
  });
});
