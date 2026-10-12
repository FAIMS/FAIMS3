// SPDX-License-Identifier: Apache-2.0
import {configureStore} from '@reduxjs/toolkit';
import {beforeEach, describe, expect, it} from 'vitest';
import contextualLayersReducer, {
  bindContextualLayersStore,
  type ContextualLayersState,
} from '../../../context/slices/contextualLayersSlice';
import {updateContextualLayerPrefs} from './contextualLayerStore';

const seeded = (): ContextualLayersState => ({
  files: {
    layer: {
      assetId: 'layer',
      contentHash: 'hash',
      kind: 'geojson',
      name: 'Boundary',
      byteSize: 10,
      extent4326: [0, 0, 1, 1],
      defaultStyle: {
        opacity: 1,
        stroke: '#1565c0',
        fill: '#1565c080',
        lineWidth: 2,
        pointSize: 6,
      },
      filename: 'layer-hash.geojson',
      projectIds: ['survey'],
    },
  },
  prefs: {},
  seenHashByProject: {},
});

describe('updateContextualLayerPrefs', () => {
  let store: ReturnType<
    typeof configureStore<{contextualLayers: ContextualLayersState}>
  >;

  beforeEach(() => {
    store = configureStore({
      reducer: {contextualLayers: contextualLayersReducer},
      preloadedState: {contextualLayers: seeded()},
    });
    bindContextualLayersStore(store);
  });

  it('keeps every opacity edit, with the last one winning', async () => {
    await Promise.all(
      Array.from({length: 8}, (_, index) =>
        updateContextualLayerPrefs('layer', {opacity: (index + 1) / 10})
      )
    );

    expect(store.getState().contextualLayers.prefs.layer.opacity).toBe(0.8);
  });

  it('drops layer metadata when the app store is reset', async () => {
    await updateContextualLayerPrefs('layer', {
      opacity: 0.4,
      stroke: '#ff0000',
    });

    store.dispatch({type: 'RESET_STORE'});

    expect(store.getState().contextualLayers).toEqual({
      files: {},
      prefs: {},
      seenHashByProject: {},
    });
  });
});
