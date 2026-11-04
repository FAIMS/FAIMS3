// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {
  backlogIsStarved,
  capacityNeeded,
  capacityScaleMap,
  DEFAULT_CAPACITY_SCALE_IN_COOLDOWN_MS,
  DEFAULT_CAPACITY_SCALE_THRESHOLDS,
  DEFAULT_CAPACITY_STARVATION_MS,
  defaultScaleInCooldownMs,
  parseCapacityScaleThresholds,
  reconcileCapacity,
  staleCapacityBonus,
} from '../src/spatial/reconcileCapacity';
import {MockCapacityProvider} from '../src/services/capacityProvider';

const defaultScale = {
  max: 4,
  scaleThresholds: DEFAULT_CAPACITY_SCALE_THRESHOLDS,
};

describe('parseCapacityScaleThresholds', () => {
  it('parses a CSV of strictly increasing positive integers', () => {
    expect(parseCapacityScaleThresholds('3,8,16,32')).toEqual([3, 8, 16, 32]);
    expect(parseCapacityScaleThresholds(' 3, 8 ,16,32 ')).toEqual([
      3, 8, 16, 32,
    ]);
  });

  it('allows a single tip or an empty list', () => {
    expect(parseCapacityScaleThresholds('8')).toEqual([8]);
    expect(parseCapacityScaleThresholds('')).toEqual([]);
  });

  it('rejects non-integers, zeros, and non-increasing lists', () => {
    expect(() => parseCapacityScaleThresholds('3,foo')).toThrow(
      /positive integers/
    );
    expect(() => parseCapacityScaleThresholds('0,3')).toThrow(
      /positive integers/
    );
    expect(() => parseCapacityScaleThresholds('8,3')).toThrow(
      /strictly increasing/
    );
    expect(() => parseCapacityScaleThresholds('3,3')).toThrow(
      /strictly increasing/
    );
  });
});

describe('capacityScaleMap', () => {
  it('starts at 1 worker and adds a step per tip', () => {
    expect(capacityScaleMap([3, 8, 16, 32])).toEqual([
      {depth: 1, workers: 1},
      {depth: 3, workers: 2},
      {depth: 8, workers: 3},
      {depth: 16, workers: 4},
      {depth: 32, workers: 5},
    ]);
  });

  it('is only the implicit 1-worker step when there are no tips', () => {
    expect(capacityScaleMap([])).toEqual([{depth: 1, workers: 1}]);
  });
});

describe('capacityNeeded', () => {
  it('is zero when the queue is empty', () => {
    expect(capacityNeeded({inFlight: 0, unclaimed: 0, ...defaultScale})).toBe(
      0
    );
  });

  it('keeps one worker below the first tip, including two jobs', () => {
    expect(capacityNeeded({inFlight: 0, unclaimed: 1, ...defaultScale})).toBe(
      1
    );
    expect(capacityNeeded({inFlight: 1, unclaimed: 1, ...defaultScale})).toBe(
      1
    );
  });

  it('steps up at each tip and caps at max', () => {
    expect(capacityNeeded({inFlight: 0, unclaimed: 3, ...defaultScale})).toBe(
      2
    );
    expect(capacityNeeded({inFlight: 2, unclaimed: 6, ...defaultScale})).toBe(
      3
    );
    expect(capacityNeeded({inFlight: 0, unclaimed: 16, ...defaultScale})).toBe(
      4
    );
    expect(capacityNeeded({inFlight: 0, unclaimed: 40, ...defaultScale})).toBe(
      4
    );
  });

  it('stays at one worker when there are no tips', () => {
    expect(
      capacityNeeded({
        inFlight: 0,
        unclaimed: 20,
        max: 4,
        scaleThresholds: [],
      })
    ).toBe(1);
  });

  it('adds one worker when the oldest unclaimed job is past the starvation timeout', () => {
    expect(
      capacityNeeded({
        inFlight: 1,
        unclaimed: 1,
        oldestUnclaimedMs: DEFAULT_CAPACITY_STARVATION_MS,
        ...defaultScale,
      })
    ).toBe(2);
  });

  it('does not add a worker when the oldest unclaimed job is still fresh', () => {
    expect(
      capacityNeeded({
        inFlight: 1,
        unclaimed: 1,
        oldestUnclaimedMs: DEFAULT_CAPACITY_STARVATION_MS - 1,
        ...defaultScale,
      })
    ).toBe(1);
  });

  it('still caps a starvation bump at max', () => {
    expect(
      capacityNeeded({
        inFlight: 1,
        unclaimed: 40,
        oldestUnclaimedMs: DEFAULT_CAPACITY_STARVATION_MS,
        ...defaultScale,
      })
    ).toBe(4);
  });

  it('does not apply staleness when starvationMs is 0', () => {
    expect(
      capacityNeeded({
        inFlight: 1,
        unclaimed: 1,
        oldestUnclaimedMs: DEFAULT_CAPACITY_STARVATION_MS,
        ...defaultScale,
        starvationMs: 0,
      })
    ).toBe(1);
  });

  it('holds the first extra worker until the scale-in cooldown elapses', () => {
    expect(
      capacityNeeded({
        inFlight: 1,
        unclaimed: 1,
        oldestUnclaimedMs:
          DEFAULT_CAPACITY_STARVATION_MS +
          DEFAULT_CAPACITY_SCALE_IN_COOLDOWN_MS -
          1,
        ...defaultScale,
      })
    ).toBe(2);
  });

  it('adds another worker after each scale-in cooldown on the same stale job', () => {
    const fourJobs = {inFlight: 1, unclaimed: 3, ...defaultScale};
    expect(
      capacityNeeded({
        ...fourJobs,
        oldestUnclaimedMs: DEFAULT_CAPACITY_STARVATION_MS,
      })
    ).toBe(3);
    expect(
      capacityNeeded({
        ...fourJobs,
        oldestUnclaimedMs:
          DEFAULT_CAPACITY_STARVATION_MS +
          DEFAULT_CAPACITY_SCALE_IN_COOLDOWN_MS,
      })
    ).toBe(4);
  });

  it('never asks for more workers than jobs in the queue', () => {
    expect(
      capacityNeeded({
        inFlight: 1,
        unclaimed: 1,
        oldestUnclaimedMs:
          DEFAULT_CAPACITY_STARVATION_MS +
          4 * DEFAULT_CAPACITY_SCALE_IN_COOLDOWN_MS,
        ...defaultScale,
      })
    ).toBe(2);
  });

  it('does not add further extras when scaleInCooldownMs is 0', () => {
    expect(
      capacityNeeded({
        inFlight: 1,
        unclaimed: 1,
        oldestUnclaimedMs:
          DEFAULT_CAPACITY_STARVATION_MS +
          4 * DEFAULT_CAPACITY_SCALE_IN_COOLDOWN_MS,
        ...defaultScale,
        scaleInCooldownMs: 0,
      })
    ).toBe(2);
  });
});

describe('staleCapacityBonus', () => {
  const starved = {
    unclaimed: 1,
    starvationMs: DEFAULT_CAPACITY_STARVATION_MS,
    scaleInCooldownMs: DEFAULT_CAPACITY_SCALE_IN_COOLDOWN_MS,
  };

  it('is zero until starvation, then steps once per cooldown', () => {
    expect(
      staleCapacityBonus({
        ...starved,
        oldestUnclaimedMs: DEFAULT_CAPACITY_STARVATION_MS - 1,
      })
    ).toBe(0);
    expect(
      staleCapacityBonus({
        ...starved,
        oldestUnclaimedMs: DEFAULT_CAPACITY_STARVATION_MS,
      })
    ).toBe(1);
    expect(
      staleCapacityBonus({
        ...starved,
        oldestUnclaimedMs:
          DEFAULT_CAPACITY_STARVATION_MS +
          DEFAULT_CAPACITY_SCALE_IN_COOLDOWN_MS,
      })
    ).toBe(2);
  });
});

describe('defaultScaleInCooldownMs', () => {
  it('is twice the starvation timeout', () => {
    expect(defaultScaleInCooldownMs()).toBe(
      DEFAULT_CAPACITY_SCALE_IN_COOLDOWN_MS
    );
    expect(defaultScaleInCooldownMs(120_000)).toBe(240_000);
  });
});

describe('backlogIsStarved', () => {
  it('is true only when an unclaimed job has waited at least the timeout', () => {
    expect(
      backlogIsStarved({
        unclaimed: 1,
        oldestUnclaimedMs: DEFAULT_CAPACITY_STARVATION_MS,
        starvationMs: DEFAULT_CAPACITY_STARVATION_MS,
      })
    ).toBe(true);
    expect(
      backlogIsStarved({
        unclaimed: 1,
        oldestUnclaimedMs: DEFAULT_CAPACITY_STARVATION_MS - 1,
        starvationMs: DEFAULT_CAPACITY_STARVATION_MS,
      })
    ).toBe(false);
    expect(
      backlogIsStarved({
        unclaimed: 0,
        oldestUnclaimedMs: DEFAULT_CAPACITY_STARVATION_MS,
        starvationMs: DEFAULT_CAPACITY_STARVATION_MS,
      })
    ).toBe(false);
  });
});

describe('reconcileCapacity', () => {
  it('does nothing when the queue is empty, even if a worker is running', async () => {
    const provider = new MockCapacityProvider(1, 0);
    const result = await reconcileCapacity({
      provider,
      inFlight: 0,
      unclaimed: 0,
      ...defaultScale,
    });
    expect(result).toEqual({needed: 0, ensured: false});
    expect(provider.ensured).toEqual([]);
    expect(provider.running).toBe(1);
  });

  it('ensures one worker when two jobs are unclaimed and nothing is running', async () => {
    const provider = new MockCapacityProvider(0, 0);
    const result = await reconcileCapacity({
      provider,
      inFlight: 0,
      unclaimed: 2,
      ...defaultScale,
    });
    expect(result).toEqual({needed: 1, ensured: true});
    expect(provider.ensured).toEqual([1]);
    expect(provider.running).toBe(1);
  });

  it('does not call ensure when in-flight work is already covered', async () => {
    const provider = new MockCapacityProvider(1, 0);
    const result = await reconcileCapacity({
      provider,
      inFlight: 2,
      unclaimed: 0,
      ...defaultScale,
    });
    expect(result).toEqual({needed: 1, ensured: false});
    expect(provider.ensured).toEqual([]);
  });

  it('ensures two workers once the first tip is reached', async () => {
    const provider = new MockCapacityProvider(0, 0);
    const result = await reconcileCapacity({
      provider,
      inFlight: 0,
      unclaimed: 3,
      ...defaultScale,
    });
    expect(result).toEqual({needed: 2, ensured: true});
    expect(provider.ensured).toEqual([2]);
  });

  it('does not call ensure when running plus pending already covers the step', async () => {
    const provider = new MockCapacityProvider(1, 1);
    const result = await reconcileCapacity({
      provider,
      inFlight: 0,
      unclaimed: 3,
      ...defaultScale,
    });
    expect(result).toEqual({needed: 2, ensured: false});
    expect(provider.ensured).toEqual([]);
  });

  it('caps needed at max even when later tips would ask for more', async () => {
    const provider = new MockCapacityProvider(0, 0);
    const result = await reconcileCapacity({
      provider,
      inFlight: 1,
      unclaimed: 40,
      ...defaultScale,
    });
    expect(result.needed).toBe(4);
    expect(provider.ensured).toEqual([4]);
  });

  it('ensures one extra worker when the oldest unclaimed job is starving', async () => {
    const provider = new MockCapacityProvider(1, 0);
    const result = await reconcileCapacity({
      provider,
      inFlight: 1,
      unclaimed: 1,
      oldestUnclaimedMs: DEFAULT_CAPACITY_STARVATION_MS,
      ...defaultScale,
    });
    expect(result).toEqual({needed: 2, ensured: true});
    expect(provider.ensured).toEqual([2]);
  });

  it('does not scale on a fresh unclaimed job below the first depth tip', async () => {
    const provider = new MockCapacityProvider(1, 0);
    const result = await reconcileCapacity({
      provider,
      inFlight: 1,
      unclaimed: 1,
      oldestUnclaimedMs: DEFAULT_CAPACITY_STARVATION_MS - 1,
      ...defaultScale,
    });
    expect(result).toEqual({needed: 1, ensured: false});
    expect(provider.ensured).toEqual([]);
  });

  it('ensures a second extra worker after the scale-in cooldown on the same stale job', async () => {
    const provider = new MockCapacityProvider(2, 0);
    const result = await reconcileCapacity({
      provider,
      inFlight: 1,
      unclaimed: 2,
      oldestUnclaimedMs:
        DEFAULT_CAPACITY_STARVATION_MS + DEFAULT_CAPACITY_SCALE_IN_COOLDOWN_MS,
      ...defaultScale,
    });
    expect(result).toEqual({needed: 3, ensured: true});
    expect(provider.ensured).toEqual([3]);
  });

  it('does not re-ensure during the cooldown while the new worker is already counted', async () => {
    const provider = new MockCapacityProvider(1, 1);
    const result = await reconcileCapacity({
      provider,
      inFlight: 1,
      unclaimed: 1,
      oldestUnclaimedMs:
        DEFAULT_CAPACITY_STARVATION_MS +
        DEFAULT_CAPACITY_SCALE_IN_COOLDOWN_MS -
        1,
      ...defaultScale,
    });
    expect(result).toEqual({needed: 2, ensured: false});
    expect(provider.ensured).toEqual([]);
  });
});
