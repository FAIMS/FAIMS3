// SPDX-License-Identifier: Apache-2.0
import {renderHook} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {
  createTileLoadController,
  TILE_LOAD_CONTROLLER,
} from './tileLoadControl';
import {useBaseMapTileLoads} from './useBaseMapTileLoads';

type FakeLayer = {
  visible: boolean;
  listeners: Array<() => void>;
  get: (key: string) => unknown;
  getVisible: () => boolean;
  setVisible: (visible: boolean) => void;
  on: (type: string, listener: () => void) => void;
  un: (type: string, listener: () => void) => void;
};

function fakeLayer() {
  const loads = createTileLoadController(1);
  const layer: FakeLayer = {
    visible: true,
    listeners: [],
    get: (key: string) => (key === TILE_LOAD_CONTROLLER ? loads : undefined),
    getVisible: () => layer.visible,
    setVisible(visible: boolean) {
      if (layer.visible === visible) {
        return;
      }
      layer.visible = visible;
      for (const listener of layer.listeners) {
        listener();
      }
    },
    on(_type: string, listener: () => void) {
      layer.listeners.push(listener);
    },
    un(_type: string, listener: () => void) {
      layer.listeners = layer.listeners.filter(item => item !== listener);
    },
  };
  return {layer, loads};
}

function fakeMap() {
  return {
    getView: () => ({
      getInteracting: () => false,
      getResolution: () => 1,
    }),
    getLayers: () => ({
      forEach: () => undefined,
    }),
    on: () => undefined,
    un: () => undefined,
  };
}

describe('useBaseMapTileLoads', () => {
  it('stops the satellite queue when that layer is hidden', async () => {
    const streets = fakeLayer();
    const satellite = fakeLayer();
    renderHook(() =>
      useBaseMapTileLoads(
        fakeMap() as never,
        streets.layer as never,
        satellite.layer as never
      )
    );
    expect(satellite.loads.stopped).toBe(false);
    satellite.layer.setVisible(false);
    expect(satellite.loads.stopped).toBe(true);
    expect(streets.loads.stopped).toBe(false);
    await expect(satellite.loads.run(async () => undefined)).rejects.toThrow();
  });

  it('stops every attached queue when the map unmounts', async () => {
    const streets = fakeLayer();
    const satellite = fakeLayer();
    const {unmount} = renderHook(() =>
      useBaseMapTileLoads(
        fakeMap() as never,
        streets.layer as never,
        satellite.layer as never
      )
    );
    unmount();
    expect(streets.loads.stopped).toBe(true);
    expect(satellite.loads.stopped).toBe(true);
    await expect(streets.loads.run(async () => undefined)).rejects.toThrow();
    await expect(satellite.loads.run(async () => undefined)).rejects.toThrow();
  });
});
