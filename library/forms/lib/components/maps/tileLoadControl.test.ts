// SPDX-License-Identifier: Apache-2.0
import TileState from 'ol/TileState';
import {describe, expect, it} from 'vitest';
import {
  BASE_MAP_TILE_CONCURRENCY,
  createTileLoadController,
  createTileLoadGate,
  createTileLoadLimiter,
} from './tileLoadControl';

function fakeTile() {
  let state = TileState.IDLE;
  return {
    getState: () => state,
    setState(next: number) {
      state = next;
    },
  };
}

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

  it('marks overflow and pan tiles as deferred errors', () => {
    const loads = createTileLoadController(2);
    const first = fakeTile();
    const second = fakeTile();
    const third = fakeTile();
    expect(loads.begin(first as never)).toBe(true);
    expect(loads.begin(second as never)).toBe(true);
    expect(loads.begin(third as never)).toBe(false);
    expect(third.getState()).toBe(TileState.ERROR);

    loads.gate.startInteraction();
    const duringPan = fakeTile();
    expect(loads.begin(duringPan as never)).toBe(false);
    expect(duringPan.getState()).toBe(TileState.ERROR);
  });
});
