// SPDX-License-Identifier: Apache-2.0

/*
 * Description:
 *   Extract a compass heading from browser DeviceOrientation events.
 *
 *   Safari/iOS exposes `webkitCompassHeading` (0 = north, clockwise) and
 *   already accounts for screen rotation. Chrome Android uses
 *   `deviceorientationabsolute`: `alpha` is 0 when the device top points
 *   north, increasing counter-clockwise, so heading = 360 − alpha, then
 *   add `screen.orientation.angle`.
 *
 *   Relative (non-absolute) `alpha` is a device-relative yaw, not a
 *   compass — ignore it unless `absolute === true`. Chrome often omits
 *   `absolute` on `deviceorientation`; treat that as relative so it cannot
 *   overwrite `deviceorientationabsolute`. Desktop typically has no heading.
 */

import {isFiniteHeading, normalizeHeading} from './heading';

/** Fields we read from DeviceOrientationEvent (plus Safari's extra heading). */
export interface DeviceOrientationHeadingEvent {
  /** Rotation about Z in degrees, or null if the sensor has no reading. */
  alpha: number | null;
  /** True when `alpha` is Earth-referenced rather than device-relative. */
  absolute?: boolean;
  /** Safari/iOS compass heading, 0–360 clockwise from north. */
  webkitCompassHeading?: number;
}

/**
 * Compass heading in degrees (0 = north, clockwise), or null if the event
 * is not a usable compass reading.
 */
export function headingFromDeviceOrientation(
  event: DeviceOrientationHeadingEvent,
  screenAngleDeg = 0
): number | null {
  if (isFiniteHeading(event.webkitCompassHeading)) {
    return normalizeHeading(event.webkitCompassHeading);
  }
  // Only Earth-referenced alpha. `undefined` is relative on Chrome's
  // deviceorientation and must not drive the triangle.
  if (event.absolute !== true || !isFiniteHeading(event.alpha)) {
    return null;
  }
  return normalizeHeading(360 - event.alpha + screenAngleDeg);
}

/**
 * Current display rotation in degrees. Needed so absolute `alpha` stays
 * aligned when the user rotates the phone. Falls back to the legacy
 * `window.orientation` integer used by older WebKit.
 */
export function screenOrientationAngle(): number {
  const modern = screen.orientation?.angle;
  if (typeof modern === 'number' && Number.isFinite(modern)) {
    return modern;
  }
  const legacy = (window as Window & {orientation?: number}).orientation;
  return typeof legacy === 'number' && Number.isFinite(legacy) ? legacy : 0;
}
