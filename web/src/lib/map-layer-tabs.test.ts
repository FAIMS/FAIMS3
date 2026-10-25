// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {parseMapLayerTab} from './map-layer-tabs';

describe('parseMapLayerTab', () => {
  it('accepts the stable asset-page tab ids', () => {
    expect(parseMapLayerTab('details')).toBe('details');
    expect(parseMapLayerTab('preview')).toBe('preview');
    expect(parseMapLayerTab('links')).toBe('links');
    expect(parseMapLayerTab('actions')).toBe('actions');
  });

  it('defaults unknown or missing values to details', () => {
    expect(parseMapLayerTab(undefined)).toBe('details');
    expect(parseMapLayerTab('nope')).toBe('details');
  });
});
