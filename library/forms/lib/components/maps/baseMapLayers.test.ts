// SPDX-License-Identifier: Apache-2.0
import MVT from 'ol/format/MVT';
import VectorTileLayer from 'ol/layer/VectorTile';
import VectorTileSource from 'ol/source/VectorTile';
import {afterEach, describe, expect, it} from 'vitest';
import {
  applyBaseMapLayerPaint,
  applyBaseMapLayerPatch,
  BASE_MAP_SATELLITE_ID,
  BASE_MAP_VECTOR_ID,
  bindVectorTileBackgroundToLayerOpacity,
  defaultBaseMapLayersState,
  normalizeBaseMapLayersState,
  readBaseMapLayersState,
  writeBaseMapLayersState,
} from './baseMapLayers';

function streetsLayer(background = 'rgb(242, 236, 225)') {
  return new VectorTileLayer({
    source: new VectorTileSource({format: new MVT()}),
    background,
  });
}

function backgroundColor(
  layer: VectorTileLayer,
  resolution = 1
): string | undefined {
  const background = layer.getBackground();
  if (typeof background === 'function') {
    return background(resolution);
  }
  return background || undefined;
}

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

  it('fades the streets VectorTile background with layer opacity', () => {
    const layer = streetsLayer();
    applyBaseMapLayerPaint(
      layer,
      {visible: true, opacity: 0.4, zIndex: 0},
      true
    );
    expect(backgroundColor(layer)).toBe('rgba(242,236,225,0.4)');

    layer.setOpacity(0.2);
    expect(backgroundColor(layer)).toBe('rgba(242,236,225,0.2)');
  });

  it('rebinds after applyStyle replaces the streets background', () => {
    const layer = streetsLayer();
    bindVectorTileBackgroundToLayerOpacity(layer);
    layer.setOpacity(0.5);
    layer.setBackground('rgb(248, 244, 240)');
    bindVectorTileBackgroundToLayerOpacity(layer);
    expect(backgroundColor(layer)).toBe('rgba(248,244,240,0.5)');
  });
});
