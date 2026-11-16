// SPDX-License-Identifier: Apache-2.0
import {Geolocation} from '@capacitor/geolocation';
import {useEffect, useState} from 'react';
import {loadLastLocation, saveLastLocation} from './lastKnownLocation';

/** Accept a fix this old rather than waking the GPS radio. */
const LOCATION_MAX_AGE_MS = 5 * 60 * 1000;
const LOCATION_TIMEOUT_MS = 4000;

/**
 * Last-known device coordinates, refreshed at most once when `enabled`.
 * Does not watch the GPS — the map already does that while it is open.
 */
export function useOccasionalDeviceLocation(
  enabled = true
): [number, number] | undefined {
  const [coords, setCoords] = useState<[number, number] | undefined>(
    () => loadLastLocation() ?? undefined
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const cached = loadLastLocation();
    if (cached) {
      setCoords(cached);
    }
    let cancelled = false;
    Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: LOCATION_TIMEOUT_MS,
      maximumAge: LOCATION_MAX_AGE_MS,
    })
      .then(position => {
        if (cancelled) {
          return;
        }
        const next: [number, number] = [
          position.coords.longitude,
          position.coords.latitude,
        ];
        saveLastLocation(next);
        setCoords(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return coords;
}
