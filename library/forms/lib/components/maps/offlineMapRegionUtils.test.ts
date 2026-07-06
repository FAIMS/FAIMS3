import type {OfflineMapRegion} from '@faims3/data-model';
import {describe, expect, it} from 'vitest';
import {offlineMapRegionsEqual} from './offlineMapRegionUtils';

const region: OfflineMapRegion = {
  type: 'Polygon',
  coordinates: [
    [
      [150.0, -34.0],
      [151.0, -34.0],
      [151.0, -33.0],
      [150.0, -33.0],
      [150.0, -34.0],
    ],
  ],
};

describe('offlineMapRegionsEqual', () => {
  it('matches regions with tiny floating-point differences', () => {
    const almostSame: OfflineMapRegion = {
      type: 'Polygon',
      coordinates: [
        [
          [150.0000000001, -34.0],
          [151.0, -34.0],
          [151.0, -33.0],
          [150.0, -33.0],
          [150.0000000001, -34.0],
        ],
      ],
    };

    expect(offlineMapRegionsEqual(region, almostSame)).toBe(true);
  });
});
