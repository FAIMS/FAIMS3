// SPDX-License-Identifier: Apache-2.0
import {afterEach, describe, expect, it} from 'vitest';
import {
  applyBaseMapLayerPaint,
  applyBaseMapLayerPatch,
  BASE_MAP_SATELLITE_ID,
  BASE_MAP_VECTOR_ID,
  defaultBaseMapLayersState,
  normalizeBaseMapLayersState,
  readBaseMapLayersState,
  writeBaseMapLayersState,
} from './baseMapLayers';

afterEach(() => {
  localStorage.clear();
});

describe('baseMapLayers', () => {
  it('restores the exclusive satellite toggle as independent prefs', () => {
    localStorage.setItem('map-layer-preference', 'satellite');
    expect(readBaseMapLayersState()).toEqual({
      vector: {visible: false, opacity: 1, zIndex: 0},
      satellite: {visible: true, opacity: 1, zIndex: 1},
    });
  });

  it('reads stored streets and satellite paint prefs', () => {
    writeBaseMapLayersState({
      vector: {visible: true, opacity: 0.4, zIndex: 3},
      satellite: {visible: true, opacity: 0.9, zIndex: 2},
    });
    expect(readBaseMapLayersState()).toEqual({
      vector: {visible: true, opacity: 0.4, zIndex: 3},
      satellite: {visible: true, opacity: 0.9, zIndex: 2},
    });
  });

  it('ignores an unknown id and clamps opacity', () => {
    const current = defaultBaseMapLayersState();
    expect(applyBaseMapLayerPatch(current, 'other', {visible: false})).toBe(
      current
    );
    expect(
      applyBaseMapLayerPatch(current, BASE_MAP_VECTOR_ID, {opacity: 4}).vector
        .opacity
    ).toBe(1);
    expect(
      applyBaseMapLayerPatch(current, BASE_MAP_SATELLITE_ID, {opacity: -1})
        .satellite.opacity
    ).toBe(0);
  });

  it('fills missing stored fields and paints the OpenLayers layer', () => {
    expect(normalizeBaseMapLayersState({vector: {opacity: 0.5}})).toEqual({
      vector: {visible: true, opacity: 0.5, zIndex: 0},
      satellite: {visible: false, opacity: 1, zIndex: 1},
    });

    const calls = {visible: false, opacity: 0, zIndex: 0};
    applyBaseMapLayerPaint(
      {
        setVisible: visible => {
          calls.visible = visible;
        },
        setOpacity: opacity => {
          calls.opacity = opacity;
        },
        setZIndex: zIndex => {
          calls.zIndex = zIndex;
        },
      },
      {visible: true, opacity: 0.25, zIndex: 8},
      false
    );
    expect(calls).toEqual({visible: false, opacity: 0.25, zIndex: 8});
  });
});
