// SPDX-License-Identifier: Apache-2.0
/** Last GPS fix the map persisted, in EPSG:4326 [longitude, latitude]. */
const LAST_LOCATION_KEY = 'last_map_center';

export function saveLastLocation(coords: [number, number]) {
  try {
    localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(coords));
  } catch {
    // Silently ignore — localStorage can be unavailable in private browsing
    // or when storage quota is exceeded. Losing the cached location is
    // acceptable; the map will fall back to Sydney on next open.
  }
}

export function loadLastLocation(): [number, number] | null {
  try {
    const stored = localStorage.getItem(LAST_LOCATION_KEY);
    if (stored) {
      const coords = JSON.parse(stored);
      if (
        Array.isArray(coords) &&
        coords.length === 2 &&
        typeof coords[0] === 'number' &&
        typeof coords[1] === 'number'
      ) {
        return coords as [number, number];
      }
    }
  } catch {
    // malformed JSON in localStorage is treated as no cache
  }
  return null;
}
