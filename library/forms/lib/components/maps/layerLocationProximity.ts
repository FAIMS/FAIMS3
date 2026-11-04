// SPDX-License-Identifier: Apache-2.0
/** EPSG:4326 [minLon, minLat, maxLon, maxLat]. */
export type Extent4326 = readonly [number, number, number, number];

const EARTH_RADIUS_M = 6_371_000;
/** Smallest distance we bother naming when the point is outside the extent. */
const MIN_DISTANCE_M = 5;

/** Device is on the layer, or how far and which way it sits from the extent. */
export type LayerLocationRelation =
  | {kind: 'inside'}
  | {
      kind: 'away';
      meters: number;
      label: string;
      /** Clockwise degrees from north, snapped to a 16-point compass. */
      bearingDegrees: number;
      cardinal: CardinalDirection;
    };

/** One step finer than the 8-point compass: N, NNE, NE, ENE, … */
export const BEARING_STEP_DEGREES = 22.5;

/** 16-point compass names, clockwise from north. */
export const CARDINAL_DIRECTIONS = [
  'north',
  'north-northeast',
  'northeast',
  'east-northeast',
  'east',
  'east-southeast',
  'southeast',
  'south-southeast',
  'south',
  'south-southwest',
  'southwest',
  'west-southwest',
  'west',
  'west-northwest',
  'northwest',
  'north-northwest',
] as const;
export type CardinalDirection = (typeof CARDINAL_DIRECTIONS)[number];

/** True when the lon/lat sits inside or on the extent. */
export function pointOverlapsExtent(
  longitude: number,
  latitude: number,
  extent: Extent4326
): boolean {
  const [minLon, minLat, maxLon, maxLat] = extent;
  return (
    longitude >= minLon &&
    longitude <= maxLon &&
    latitude >= minLat &&
    latitude <= maxLat
  );
}

/**
 * Great-circle distance from a point to the nearest point on the extent.
 * Zero when the point is inside or on the boundary.
 */
export function distanceMetersToExtent(
  longitude: number,
  latitude: number,
  extent: Extent4326
): number {
  if (pointOverlapsExtent(longitude, latitude, extent)) {
    return 0;
  }
  const [nearestLon, nearestLat] = nearestPointOnExtent(
    longitude,
    latitude,
    extent
  );
  return haversineMeters(longitude, latitude, nearestLon, nearestLat);
}

/**
 * Distance in a 1-2-5 series (5m, 10m, 20m, 50m, 100m, 1km, 10km, 1000km).
 */
export function formatLayerDistance(meters: number): string {
  const rounded = nearest125Meters(Math.max(0, meters));
  if (rounded < 1000) {
    return `${rounded}m`;
  }
  return `${rounded / 1000}km`;
}

/** Closest lon/lat on the extent rectangle to the point. */
export function nearestPointOnExtent(
  longitude: number,
  latitude: number,
  extent: Extent4326
): [number, number] {
  const [minLon, minLat, maxLon, maxLat] = extent;
  return [clamp(longitude, minLon, maxLon), clamp(latitude, minLat, maxLat)];
}

/**
 * Initial great-circle bearing from one lon/lat to another, 0 = north,
 * clockwise through 360.
 */
export function initialBearingDegrees(
  fromLon: number,
  fromLat: number,
  toLon: number,
  toLat: number
): number {
  const phi1 = toRadians(fromLat);
  const phi2 = toRadians(toLat);
  const dLambda = toRadians(toLon - fromLon);
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

/** Snap a bearing to the nearest 16-point compass step. */
export function snapBearingDegrees(degrees: number): number {
  const normalized = ((degrees % 360) + 360) % 360;
  const stepped =
    Math.round(normalized / BEARING_STEP_DEGREES) * BEARING_STEP_DEGREES;
  return stepped % 360;
}

/** Compass name for a bearing in degrees. */
export function cardinalFromBearing(degrees: number): CardinalDirection {
  const index =
    Math.round(snapBearingDegrees(degrees) / BEARING_STEP_DEGREES) %
    CARDINAL_DIRECTIONS.length;
  return CARDINAL_DIRECTIONS[index]!;
}

/** Whether the device is on the layer, or how far and which way. */
export function layerLocationRelation(
  longitude: number,
  latitude: number,
  extent: Extent4326
): LayerLocationRelation {
  if (pointOverlapsExtent(longitude, latitude, extent)) {
    return {kind: 'inside'};
  }
  const [toLon, toLat] = nearestPointOnExtent(longitude, latitude, extent);
  const meters = haversineMeters(longitude, latitude, toLon, toLat);
  const bearingDegrees = snapBearingDegrees(
    initialBearingDegrees(longitude, latitude, toLon, toLat)
  );
  return {
    kind: 'away',
    meters,
    label: formatLayerDistance(meters),
    bearingDegrees,
    cardinal: cardinalFromBearing(bearingDegrees),
  };
}

/** Clamp `value` to `[min, max]`. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Degrees to radians. */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Radians to degrees. */
function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/** Great-circle distance in meters between two WGS84 points. */
function haversineMeters(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number
): number {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const dPhi = toRadians(lat2 - lat1);
  const dLambda = toRadians(lon2 - lon1);
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Round a distance to a 1–2–5 × 10^n meter step, never below {@link MIN_DISTANCE_M}. */
function nearest125Meters(meters: number): number {
  if (meters <= MIN_DISTANCE_M) {
    return MIN_DISTANCE_M;
  }
  const exp = Math.floor(Math.log10(meters));
  const base = 10 ** exp;
  const candidates = [1, 2, 5, 10].map(step => step * base);
  let best = candidates[0]!;
  let bestDist = Math.abs(best - meters);
  for (const candidate of candidates) {
    const dist = Math.abs(candidate - meters);
    if (dist < bestDist || (dist === bestDist && candidate > best)) {
      best = candidate;
      bestDist = dist;
    }
  }
  return Math.max(MIN_DISTANCE_M, best);
}
