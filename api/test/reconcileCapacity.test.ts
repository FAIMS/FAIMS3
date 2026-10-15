// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {
  capacityNeeded,
  capacityScaleMap,
  DEFAULT_CAPACITY_SCALE_THRESHOLDS,
  parseCapacityScaleThresholds,
  reconcileCapacity,
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
});
