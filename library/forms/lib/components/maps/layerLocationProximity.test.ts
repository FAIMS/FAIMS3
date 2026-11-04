// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {
  cardinalFromBearing,
  distanceMetersToExtent,
  formatLayerDistance,
  initialBearingDegrees,
  layerLocationRelation,
  pointOverlapsExtent,
  snapBearingDegrees,
} from './layerLocationProximity';

const sydneyBlock: [number, number, number, number] = [
  151.2, -33.87, 151.21, -33.86,
];

describe('pointOverlapsExtent', () => {
  it('treats a point on the boundary as overlapping', () => {
    expect(pointOverlapsExtent(151.2, -33.87, sydneyBlock)).toBe(true);
    expect(pointOverlapsExtent(151.205, -33.865, sydneyBlock)).toBe(true);
  });

  it('rejects a point outside the box', () => {
    expect(pointOverlapsExtent(151.3, -33.865, sydneyBlock)).toBe(false);
    expect(pointOverlapsExtent(0, 0, sydneyBlock)).toBe(false);
  });
});

describe('distanceMetersToExtent', () => {
  it('is zero inside the extent', () => {
    expect(distanceMetersToExtent(151.205, -33.865, sydneyBlock)).toBe(0);
  });

  it('measures to the nearest edge, not the centre', () => {
    // ~1.1 km east of maxLon, same latitude as the box interior.
    const meters = distanceMetersToExtent(151.222, -33.865, sydneyBlock);
    expect(meters).toBeGreaterThan(1000);
    expect(meters).toBeLessThan(1300);
  });
});

describe('formatLayerDistance', () => {
  it('uses a 1-2-5 series in metres and kilometres', () => {
    expect(formatLayerDistance(3)).toBe('5m');
    expect(formatLayerDistance(8)).toBe('10m');
    expect(formatLayerDistance(80)).toBe('100m');
    expect(formatLayerDistance(7400)).toBe('5km');
    expect(formatLayerDistance(8000)).toBe('10km');
    expect(formatLayerDistance(1_200_000)).toBe('1000km');
  });
});

describe('layerLocationRelation', () => {
  it('reports inside when the point overlaps', () => {
    expect(layerLocationRelation(151.205, -33.865, sydneyBlock)).toEqual({
      kind: 'inside',
    });
  });

  it('reports a rounded distance and westward bearing when east of the box', () => {
    const relation = layerLocationRelation(151.222, -33.865, sydneyBlock);
    expect(relation.kind).toBe('away');
    if (relation.kind !== 'away') {
      return;
    }
    expect(relation.label).toBe('1km');
    expect(relation.cardinal).toBe('west');
    expect(relation.bearingDegrees).toBe(270);
  });
});

describe('initialBearingDegrees', () => {
  it('points north, east, south, and west along the axes', () => {
    expect(initialBearingDegrees(0, 0, 0, 1)).toBeCloseTo(0, 5);
    expect(initialBearingDegrees(0, 0, 1, 0)).toBeCloseTo(90, 5);
    expect(initialBearingDegrees(0, 0, 0, -1)).toBeCloseTo(180, 5);
    expect(initialBearingDegrees(0, 0, -1, 0)).toBeCloseTo(270, 5);
  });
});

describe('snapBearingDegrees', () => {
  it('uses 16 rotation stops 22.5° apart', () => {
    expect(snapBearingDegrees(0)).toBe(0);
    expect(snapBearingDegrees(10)).toBe(0);
    expect(snapBearingDegrees(12)).toBe(22.5);
    expect(snapBearingDegrees(90)).toBe(90);
    expect(snapBearingDegrees(348)).toBe(337.5);
    expect(snapBearingDegrees(350)).toBe(0);
  });
});

describe('cardinalFromBearing', () => {
  it('snaps to the nearest 16-point compass direction', () => {
    expect(cardinalFromBearing(0)).toBe('north');
    expect(cardinalFromBearing(20)).toBe('north-northeast');
    expect(cardinalFromBearing(44)).toBe('northeast');
    expect(cardinalFromBearing(70)).toBe('east-northeast');
    expect(cardinalFromBearing(90)).toBe('east');
    expect(cardinalFromBearing(200)).toBe('south-southwest');
    expect(cardinalFromBearing(220)).toBe('southwest');
    expect(cardinalFromBearing(350)).toBe('north');
  });
});
