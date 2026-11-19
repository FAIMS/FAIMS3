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

// Smooth small heading changes over this time span to reduce sensor jitter.
const STEADY_HEADING_TIME_CONSTANT_MS = 450;
// Use a shorter smoothing span so sustained turns feel responsive.
const TURN_HEADING_TIME_CONSTANT_MS = 150;
// Changes at least this large use the quicker turn response.
const QUICK_TURN_THRESHOLD_DEG = 8;
// Treat a larger change over a short interval as a possible sensor spike.
const LARGE_JUMP_THRESHOLD_DEG = 45;
// Only hold large changes that arrive within this interval.
const LARGE_JUMP_INTERVAL_MS = 250;
// Wait this long for another sample to confirm or reject a large change.
const LARGE_JUMP_CONFIRMATION_MS = 500;
// A sample within this many degrees of a held change confirms it.
const LARGE_JUMP_TOLERANCE_DEG = 35;

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
 * `alpha` is the fraction moved toward `next` (0.2 ≈ five-sample settle).
 */
export function smoothHeading(
  previous: number | null,
  next: number,
  alpha = 0.2
): number {
  if (previous == null) {
    return normalizeHeading(next);
  }
  return lerpHeading(previous, next, alpha);
}

/** Start with no accepted heading so the first valid sample can initialize it. */
export function createHeadingSmoothingState(): HeadingSmoothingState {
  return {headingDeg: null, timestampMs: null};
}

/** Return the shortest signed turn from one bearing to another. */
function signedHeadingDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

/** State for time-aware compass smoothing, including a pending large jump. */
export interface HeadingSmoothingState {
  // Latest accepted, smoothed bearing.
  headingDeg: number | null;
  // Timestamp of the latest accepted sample, used to scale smoothing.
  timestampMs: number | null;
  // A sudden change awaiting another sample to confirm or reject it.
  pendingJump?: {
    // Bearing of the held sample.
    headingDeg: number;
    // Signed turn from the last accepted bearing.
    deltaDeg: number;
    // Time the held sample arrived.
    timestampMs: number;
  };
}

/**
 * Check whether a heading change is a sudden large jump.
 */
function isLargeJump(deltaDeg: number, elapsedMs: number): boolean {
  return (
    Math.abs(deltaDeg) >= LARGE_JUMP_THRESHOLD_DEG &&
    elapsedMs <= LARGE_JUMP_INTERVAL_MS
  );
}

/**
 * Check whether a new reading confirms a previously held heading jump.
 */
function isPendingJumpConfirmed(
  pending: NonNullable<HeadingSmoothingState['pendingJump']>,
  currentHeading: number,
  nextHeading: number
): boolean {
  // Change from the held jump to the new reading.
  const afterPending = signedHeadingDelta(pending.headingDeg, nextHeading);
  // Change from the last accepted heading to the new reading.
  const fromCurrent = signedHeadingDelta(currentHeading, nextHeading);

  return (
    // Confirm if the new reading is close to the held jump.
    Math.abs(afterPending) <= LARGE_JUMP_TOLERANCE_DEG ||
    // Or if the device keeps turning in the same direction
    // and remains far enough from the last accepted heading.
    (Math.sign(afterPending) === Math.sign(pending.deltaDeg) &&
      Math.abs(fromCurrent) >= LARGE_JUMP_THRESHOLD_DEG)
  );
}

/**
 * Smooth a compass sample using elapsed time rather than sample count.
 * Small changes receive stronger damping; sustained quick turns use a shorter
 * time constant. An isolated large jump is held until another sample confirms it.
 */
export function smoothHeadingSample(
  state: HeadingSmoothingState,
  nextHeading: number,
  timestampMs: number
): HeadingSmoothingState {
  // Ignore invalid heading values or timestamps.
  if (!isFiniteHeading(nextHeading) || !Number.isFinite(timestampMs)) {
    return state;
  }

  // Initialise the heading on the first valid sample.
  const next = normalizeHeading(nextHeading);
  if (state.headingDeg == null || state.timestampMs == null) {
    return {headingDeg: next, timestampMs};
  }

  // Ignore samples older than the last accepted reading.
  if (timestampMs < state.timestampMs) {
    return state;
  }

  // Calculate the elapsed time and shortest angular difference.
  const elapsedMs = Math.max(1, timestampMs - state.timestampMs);
  const delta = signedHeadingDelta(state.headingDeg, next);
  const pending = state.pendingJump;

  // Check whether a pending jump is still within the confirmation window.
  const hasPendingJumpWithinConfirmationWindow =
    pending !== undefined &&
    timestampMs - pending.timestampMs <= LARGE_JUMP_CONFIRMATION_MS;

  // Accept a large jump if a subsequent reading confirms it.
  if (
    hasPendingJumpWithinConfirmationWindow &&
    isPendingJumpConfirmed(pending, state.headingDeg, next)
  ) {
    return applyTimedHeading(
      state.headingDeg,
      next,
      timestampMs,
      elapsedMs,
      true
    );
  }

  // Hold a new large jump, replacing any unconfirmed pending jump.
  if (isLargeJump(delta, elapsedMs)) {
    return {
      ...state,
      pendingJump: {headingDeg: next, deltaDeg: delta, timestampMs},
    };
  }

  // Apply normal smoothing, using faster response for quick turns.
  return applyTimedHeading(
    state.headingDeg,
    next,
    timestampMs,
    elapsedMs,
    Math.abs(delta) >= QUICK_TURN_THRESHOLD_DEG
  );
}

/** Move toward a sample according to elapsed time, with faster response on turns. */
function applyTimedHeading(
  previous: number,
  next: number,
  timestampMs: number,
  elapsedMs: number,
  quickTurn: boolean
): HeadingSmoothingState {
  const timeConstant = quickTurn
    ? TURN_HEADING_TIME_CONSTANT_MS
    : STEADY_HEADING_TIME_CONSTANT_MS;
  const alpha = 1 - Math.exp(-elapsedMs / timeConstant);
  return {
    headingDeg: lerpHeading(previous, next, alpha),
    timestampMs,
  };
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
  magneticDeclinationDeg,
  date,
}: {
  compass: number | null | undefined;
  gps: number | null | undefined;
  compassReference: CompassReference | null;
  latitude?: number;
  longitude?: number;
  magneticDeclinationDeg?: number;
  date?: Date;
}): number | null {
  if (isFiniteHeading(compass)) {
    if (compassReference === 'magnetic' && magneticDeclinationDeg != null) {
      return normalizeHeading(compass + magneticDeclinationDeg);
    }
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
