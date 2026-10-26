// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {
  CONTEXTUAL_LAYER_Z_INDEX_MAX,
  GPS_CURSOR_LAYER_Z_INDEX,
  OFFLINE_REGION_LAYER_Z_INDEX,
  USER_FEATURE_LAYER_Z_INDEX,
  clampLayerOpacity,
  contextualLayerZIndex,
} from './layerStack';

describe('contextualLayerZIndex', () => {
  it('keeps user geometry above every contextual layer', () => {
    expect(CONTEXTUAL_LAYER_Z_INDEX_MAX).toBeLessThan(
      OFFLINE_REGION_LAYER_Z_INDEX
    );
    expect(OFFLINE_REGION_LAYER_Z_INDEX).toBeLessThan(
      USER_FEATURE_LAYER_Z_INDEX
    );
    expect(USER_FEATURE_LAYER_Z_INDEX).toBeLessThan(GPS_CURSOR_LAYER_Z_INDEX);
  });

  it('preserves stack order inside the reference band', () => {
    expect(contextualLayerZIndex(10)).toBe(10);
    expect(contextualLayerZIndex(11)).toBe(11);
    expect(contextualLayerZIndex(10)).toBeLessThan(contextualLayerZIndex(11));
  });

  it('clamps a reference layer that would cover a pin', () => {
    expect(contextualLayerZIndex(USER_FEATURE_LAYER_Z_INDEX)).toBe(
      CONTEXTUAL_LAYER_Z_INDEX_MAX
    );
    expect(contextualLayerZIndex(10_000)).toBeLessThan(
      USER_FEATURE_LAYER_Z_INDEX
    );
  });

  it('treats a non-finite stack value as the base of the map', () => {
    expect(contextualLayerZIndex(Number.NaN)).toBe(0);
    expect(contextualLayerZIndex(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('clampLayerOpacity', () => {
  it('keeps values inside 0–1 and treats non-finite as opaque', () => {
    expect(clampLayerOpacity(0.4)).toBe(0.4);
    expect(clampLayerOpacity(-1)).toBe(0);
    expect(clampLayerOpacity(2)).toBe(1);
    expect(clampLayerOpacity(Number.NaN)).toBe(1);
  });
});
