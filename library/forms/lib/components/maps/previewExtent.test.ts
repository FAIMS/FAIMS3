// SPDX-License-Identifier: Apache-2.0
import {transformExtent} from 'ol/proj';
import {describe, expect, it} from 'vitest';
import {bufferExtent, placementExtent} from './previewExtent';

describe('bufferExtent', () => {
  it('pads a large extent by 15%', () => {
    expect(bufferExtent([0, 0, 10000, 8000])).toEqual([
      -1500, -1200, 11500, 9200,
    ]);
  });

  it('expands a small extent to a 800-unit span', () => {
    expect(bufferExtent([10, 20, 110, 120])).toEqual([-340, -330, 460, 470]);
  });

  it('pads each axis independently', () => {
    expect(bufferExtent([0, 0, 10000, 100])).toEqual([-1500, -350, 11500, 450]);
  });
});

describe('placementExtent', () => {
  it('prefers a stored 3857 bbox', () => {
    expect(placementExtent([150, -34, 151, -33], [1, 2, 3, 4])).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it('transforms a 4326 bbox when 3857 is missing', () => {
    const lonLat: [number, number, number, number] = [150, -34, 151, -33];
    expect(placementExtent(lonLat)).toEqual(
      transformExtent(lonLat, 'EPSG:4326', 'EPSG:3857')
    );
  });

  it('returns undefined when neither extent is set', () => {
    expect(placementExtent()).toBeUndefined();
  });
});
