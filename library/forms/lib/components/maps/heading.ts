// SPDX-License-Identifier: Apache-2.0

/*
 * Description:
 *   Pure heading helpers for the live map cursor.
 *
 *   The triangle means "which way the device is pointing", not travel
 *   direction. Compass wins; GPS `coords.heading` (course-over-ground) is
 *   only used when the compass is missing. W3C/Capacitor often report GPS
 *   heading as null, NaN, or (iOS) -1 when course is unknown — treat
 *   those as missing, but keep 0 (north).
 *
 *   OpenLayers / OSM are true-north. iOS Capgo already emits true heading;
 *   Android and web compass readings are magnetic, so they need WMM
 *   declination once a GPS fix is available.
 */

import {magneticDeclination} from './magneticDeclination';

/** Whether a compass bearing is relative to true north or magnetic north. */
export type CompassReference = 'true' | 'magnetic';

/**
 * True when `value` is a usable bearing in `[0, 360)`.
 * `0` is north. `NaN` is missing (browsers at speed 0). `-1` is missing
 * (iOS `CLLocation.course` / Capacitor when course is unknown).
 */
export function isFiniteHeading(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value < 360
  );
}

/** Wrap a bearing into `[0, 360)`. */
export function normalizeHeading(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/**
 * Pick a raw heading for the triangle. Does not apply declination — use
 * {@link displayHeadingDegrees} when drawing on the map.
 */
export function resolveMapHeading({
  compass,
  gps,
}: {
  compass: number | null | undefined;
  gps: number | null | undefined;
}): number | null {
  if (isFiniteHeading(compass)) {
    return normalizeHeading(compass);
  }
  if (isFiniteHeading(gps)) {
    return normalizeHeading(gps);
  }
  return null;
}

/**
 * Shortest-path interpolation around the circle. `t = 0` keeps `from`,
 * `t = 1` snaps to `to`. Handles wrap-around (359° → 1° is 2°, not 358°).
 */
export function lerpHeading(from: number, to: number, t: number): number {
  const delta = ((to - from + 540) % 360) - 180;
  return normalizeHeading(from + delta * t);
}

/**
 * Low-pass filter so magnetometer jitter does not chatter the triangle.
 * `alpha` is the fraction moved toward `next` (0.45 ≈ one-and-a-bit samples).
 */
export function smoothHeading(
  previous: number | null,
  next: number,
  alpha = 0.45
): number {
  if (previous == null) {
    return normalizeHeading(next);
  }
  return lerpHeading(previous, next, alpha);
}

/**
 * Magnetic heading → true north at `latitude`/`longitude`.
 * East declination is added: true = magnetic + declination.
 */
export function applyMagneticDeclination(
  magneticDegrees: number,
  latitude: number,
  longitude: number,
  date: Date = new Date()
): number {
  return normalizeHeading(
    magneticDegrees + magneticDeclination(latitude, longitude, date)
  );
}

/**
 * Heading drawn on the map (degrees, 0 = true north, clockwise).
 *
 * Compass first. Magnetic compass is converted to true north when a GPS
 * fix is present; without a fix the magnetic value is used as-is. GPS
 * course-over-ground is already geographic and is never declination-corrected.
 */
export function displayHeadingDegrees({
  compass,
  gps,
  compassReference,
  latitude,
  longitude,
  date,
}: {
  compass: number | null | undefined;
  gps: number | null | undefined;
  compassReference: CompassReference | null;
  latitude?: number;
  longitude?: number;
  date?: Date;
}): number | null {
  if (isFiniteHeading(compass)) {
    if (
      compassReference === 'magnetic' &&
      latitude != null &&
      longitude != null
    ) {
      return applyMagneticDeclination(compass, latitude, longitude, date);
    }
    return normalizeHeading(compass);
  }
  if (isFiniteHeading(gps)) {
    return normalizeHeading(gps);
  }
  return null;
}
