// SPDX-License-Identifier: Apache-2.0

/*
 * Description:
 *   Heading helpers: compass-vs-GPS resolve, circular lerp, WMM-2025
 *   declination (official NOAA vectors), and web DeviceOrientation parse.
 */

import {afterEach, describe, expect, it} from 'vitest';
import {
  applyMagneticDeclination,
  displayHeadingDegrees,
  isFiniteHeading,
  lerpHeading,
  normalizeHeading,
  resolveMapHeading,
  smoothHeading,
} from './heading';
import {decimalYear, magneticDeclination} from './magneticDeclination';
import {
  headingFromDeviceOrientation,
  screenOrientationAngle,
} from './webHeading';

describe('isFiniteHeading', () => {
  it('accepts 0 as north', () => {
    expect(isFiniteHeading(0)).toBe(true);
  });

  it('rejects null, undefined, and NaN', () => {
    expect(isFiniteHeading(null)).toBe(false);
    expect(isFiniteHeading(undefined)).toBe(false);
    expect(isFiniteHeading(Number.NaN)).toBe(false);
  });

  it('rejects iOS unknown-course sentinel and values outside [0, 360)', () => {
    expect(isFiniteHeading(-1)).toBe(false);
    expect(isFiniteHeading(360)).toBe(false);
    expect(isFiniteHeading(359)).toBe(true);
  });
});

describe('resolveMapHeading', () => {
  it('prefers compass over GPS', () => {
    expect(resolveMapHeading({compass: 10, gps: 90})).toBe(10);
  });

  it('falls back to GPS when compass is missing', () => {
    expect(resolveMapHeading({compass: null, gps: 90})).toBe(90);
    expect(resolveMapHeading({compass: Number.NaN, gps: 45})).toBe(45);
  });

  it('does not treat iOS GPS course -1 as a bearing', () => {
    expect(resolveMapHeading({compass: null, gps: -1})).toBeNull();
    expect(
      displayHeadingDegrees({compass: null, gps: -1, compassReference: null})
    ).toBeNull();
  });

  it('returns null when neither source is usable', () => {
    expect(resolveMapHeading({compass: null, gps: null})).toBeNull();
    expect(
      resolveMapHeading({compass: Number.NaN, gps: Number.NaN})
    ).toBeNull();
  });
});

describe('lerpHeading', () => {
  it('walks the short way across 359 → 1', () => {
    expect(lerpHeading(359, 1, 0.5)).toBeCloseTo(0);
  });

  it('walks the short way across 10 → 350', () => {
    expect(lerpHeading(10, 350, 0.5)).toBeCloseTo(0);
  });

  it('returns the start and end at t=0 and t=1', () => {
    expect(lerpHeading(10, 40, 0)).toBeCloseTo(10);
    expect(lerpHeading(10, 40, 1)).toBeCloseTo(40);
  });
});

describe('smoothHeading', () => {
  it('uses the first sample as-is', () => {
    expect(smoothHeading(null, 90)).toBe(90);
  });

  it('moves part-way toward the next sample', () => {
    expect(smoothHeading(0, 10, 0.5)).toBeCloseTo(5);
  });
});

describe('normalizeHeading', () => {
  it('wraps negative and >360 values', () => {
    expect(normalizeHeading(-10)).toBe(350);
    expect(normalizeHeading(720)).toBe(0);
  });
});

describe('applyMagneticDeclination', () => {
  it('adds east declination and wraps', () => {
    const date = new Date('2026-10-05T00:00:00Z');
    const magnetic = 350;
    const latitude = -33.87;
    const longitude = 151.21;
    const result = applyMagneticDeclination(
      magnetic,
      latitude,
      longitude,
      date
    );

    expect(result).toBeCloseTo(
      normalizeHeading(
        magnetic + magneticDeclination(latitude, longitude, date)
      ),
      5
    );
    expect(result).toBeLessThan(10);
    expect(result).toBeGreaterThan(0);
  });
});

describe('displayHeadingDegrees', () => {
  it('uses true compass without declination', () => {
    expect(
      displayHeadingDegrees({
        compass: 80,
        gps: 10,
        compassReference: 'true',
        latitude: -33.87,
        longitude: 151.21,
      })
    ).toBe(80);
  });

  it('falls back to GPS when compass is missing', () => {
    expect(
      displayHeadingDegrees({
        compass: null,
        gps: 200,
        compassReference: null,
      })
    ).toBe(200);
  });

  it('applies declination to magnetic compass when a fix is present', () => {
    const magnetic = 0;
    const date = new Date(Date.UTC(2025, 0, 1));
    expect(
      displayHeadingDegrees({
        compass: magnetic,
        gps: 90,
        compassReference: 'magnetic',
        latitude: 0,
        longitude: 21,
        date,
      })
    ).toBeCloseTo(applyMagneticDeclination(magnetic, 0, 21, date), 5);
  });
});

describe('magneticDeclination WMM-2025', () => {
  const epoch = new Date(Date.UTC(2025, 0, 1));

  // Vectors from NOAA WMM2025_TEST_VALUES.txt (decimal year, alt km, lat, lon, Dec).
  it('matches NOAA test values at epoch', () => {
    expect(magneticDeclination(43, 93, epoch, 65)).toBeCloseTo(0.5, 1);
    expect(magneticDeclination(-50, -103, epoch, 3)).toBeCloseTo(27.96, 1);
    expect(magneticDeclination(0, 21, epoch, 18)).toBeCloseTo(1.29, 1);
    expect(magneticDeclination(-33, 109, epoch, 51)).toBeCloseTo(-5.49, 1);
  });
});

describe('decimalYear', () => {
  it('maps 1 January 00:00 UTC to the integer year', () => {
    expect(decimalYear(new Date(Date.UTC(2025, 0, 1)))).toBe(2025);
  });

  it('maps the midpoint of a non-leap year to .5', () => {
    const start = Date.UTC(2025, 0, 1);
    const next = Date.UTC(2026, 0, 1);
    expect(decimalYear(new Date(start + (next - start) / 2))).toBe(2025.5);
  });
});

describe('headingFromDeviceOrientation', () => {
  it('prefers webkitCompassHeading', () => {
    expect(
      headingFromDeviceOrientation({
        alpha: 10,
        absolute: true,
        webkitCompassHeading: 45,
      })
    ).toBe(45);
  });

  it('converts absolute alpha with screen angle', () => {
    expect(headingFromDeviceOrientation({alpha: 90, absolute: true}, 0)).toBe(
      270
    );
    expect(headingFromDeviceOrientation({alpha: 90, absolute: true}, 90)).toBe(
      0
    );
  });

  it('ignores relative orientation without webkit heading', () => {
    expect(
      headingFromDeviceOrientation({alpha: 90, absolute: false})
    ).toBeNull();
  });

  it('ignores alpha when absolute is omitted', () => {
    expect(headingFromDeviceOrientation({alpha: 90})).toBeNull();
  });
});

describe('screenOrientationAngle', () => {
  const originalOrientation = window.screen.orientation;
  const originalWindowOrientation = (window as Window & {orientation?: number})
    .orientation;

  afterEach(() => {
    Object.defineProperty(window.screen, 'orientation', {
      configurable: true,
      value: originalOrientation,
    });
    Object.defineProperty(window, 'orientation', {
      configurable: true,
      value: originalWindowOrientation,
    });
  });

  it('uses screen.orientation.angle when present', () => {
    Object.defineProperty(window.screen, 'orientation', {
      configurable: true,
      value: {angle: 90},
    });
    expect(screenOrientationAngle()).toBe(90);
  });

  it('falls back to window.orientation', () => {
    Object.defineProperty(window.screen, 'orientation', {
      configurable: true,
      value: {angle: Number.NaN},
    });
    Object.defineProperty(window, 'orientation', {
      configurable: true,
      value: 180,
    });
    expect(screenOrientationAngle()).toBe(180);
  });

  it('returns 0 when neither source is a finite number', () => {
    Object.defineProperty(window.screen, 'orientation', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, 'orientation', {
      configurable: true,
      value: undefined,
    });
    expect(screenOrientationAngle()).toBe(0);
  });
});
