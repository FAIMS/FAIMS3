// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {
  BASE_MAP_TILE_CONCURRENCY,
  createTileLoadController,
  createTileLoadGate,
  createTileLoadLimiter,
  shouldPauseTileLoads,
} from './tileLoadControl';

describe('tile load control', () => {
  it('lets in-flight reads finish and skips new ones while panning', () => {
    const gate = createTileLoadGate();
    const {signal, done} = gate.branch();
    expect(signal.aborted).toBe(false);
    gate.startInteraction();
    expect(signal.aborted).toBe(false);
    expect(gate.branch().signal.aborted).toBe(true);
    gate.endInteraction();
    done();
  });

  it('caps concurrent base-map loads and defers the rest', () => {
    const limiter = createTileLoadLimiter(BASE_MAP_TILE_CONCURRENCY);
    expect(limiter.tryBegin()).toBe(true);
    expect(limiter.tryBegin()).toBe(true);
    expect(limiter.tryBegin()).toBe(false);
    limiter.end();
    expect(limiter.tryBegin()).toBe(true);
  });

  it('waits for a free slot instead of failing extra tiles', async () => {
    const loads = createTileLoadController(1);
    let firstReleased = false;
    let secondStarted = false;
    let releaseFirst!: () => void;
    const first = loads.run(
      () =>
        new Promise<void>(resolve => {
          releaseFirst = () => {
            firstReleased = true;
            resolve();
          };
        })
    );
    const second = loads.run(async () => {
      secondStarted = true;
    });
    await Promise.resolve();
    expect(secondStarted).toBe(false);
    releaseFirst();
    await Promise.all([first, second]);
    expect(firstReleased).toBe(true);
    expect(secondStarted).toBe(true);
  });

  it('holds new work until a pan ends', async () => {
    const loads = createTileLoadController(2);
    loads.gate.startInteraction();
    let started = false;
    const pending = loads.run(async () => {
      started = true;
    });
    await Promise.resolve();
    expect(started).toBe(false);
    loads.gate.endInteraction();
    await pending;
    expect(started).toBe(true);
  });

  it('does not pause tiles for a programmatic view change', () => {
    expect(shouldPauseTileLoads({getInteracting: () => false})).toBe(false);
    expect(shouldPauseTileLoads({getInteracting: () => true})).toBe(true);
  });
});
