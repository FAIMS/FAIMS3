// SPDX-License-Identifier: Apache-2.0
import {renderHook, act} from '@testing-library/react';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import {afterEach, describe, expect, it} from 'vitest';
import {
  BASE_MAP_SATELLITE_ID,
  BASE_MAP_VECTOR_ID,
  defaultBaseMapLayersState,
  readBaseMapLayersState,
  writeBaseMapLayersState,
} from './baseMapLayers';
import {useBaseMapLayers} from './useBaseMapLayers';

function layers() {
  return {
    streets: new TileLayer({source: new OSM()}),
    satellite: new TileLayer({source: new OSM()}),
  };
}

describe('useBaseMapLayers', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('persists paint updates by default', () => {
    const {streets, satellite} = layers();
    const {result} = renderHook(() =>
      useBaseMapLayers(streets, satellite, true)
    );

    act(() => {
      result.current.updateBaseLayer(BASE_MAP_VECTOR_ID, {opacity: 0.4});
    });

    expect(readBaseMapLayersState().vector.opacity).toBe(0.4);
  });

  it('keeps session-only paint when persist is false', () => {
    writeBaseMapLayersState({
      ...defaultBaseMapLayersState(),
      vector: {
        ...defaultBaseMapLayersState().vector,
        opacity: 0.2,
      },
    });
    const {streets, satellite} = layers();
    const {result} = renderHook(() =>
      useBaseMapLayers(streets, satellite, true, {persist: false})
    );

    expect(result.current.baseLayers[0]?.opacity).toBe(1);

    act(() => {
      result.current.updateBaseLayer(BASE_MAP_SATELLITE_ID, {visible: true});
      result.current.updateBaseLayer(BASE_MAP_VECTOR_ID, {opacity: 0.5});
    });

    expect(result.current.baseLayers[0]?.opacity).toBe(0.5);
    expect(readBaseMapLayersState().vector.opacity).toBe(0.2);

    act(() => {
      result.current.resetBaseLayers();
    });

    expect(result.current.baseLayers[0]?.opacity).toBe(1);
    expect(readBaseMapLayersState().vector.opacity).toBe(0.2);
  });
});
