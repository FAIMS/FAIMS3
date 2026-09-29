import {describe, expect, it} from 'vitest';
import {
  HEADING_INDICATOR_PIXEL_OFFSET,
  headingIndicatorCoordinate,
} from './headingIndicator';

describe('headingIndicatorCoordinate', () => {
  const origin: [number, number] = [100, 200];
  const resolution = 2;
  const distance = HEADING_INDICATOR_PIXEL_OFFSET * resolution;

  it('places a north bearing above the origin', () => {
    expect(headingIndicatorCoordinate(origin, 0, resolution)).toEqual([
      origin[0],
      origin[1] + distance,
    ]);
  });

  it('places an east bearing to the right of the origin', () => {
    const [x, y] = headingIndicatorCoordinate(origin, Math.PI / 2, resolution);
    expect(x).toBeCloseTo(origin[0] + distance);
    expect(y).toBeCloseTo(origin[1]);
  });

  it('places a south bearing below the origin', () => {
    const [x, y] = headingIndicatorCoordinate(origin, Math.PI, resolution);
    expect(x).toBeCloseTo(origin[0]);
    expect(y).toBeCloseTo(origin[1] - distance);
  });
});
