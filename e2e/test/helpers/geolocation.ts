import {browser} from '@wdio/globals';

/** A fixed position for deterministic geolocation capture (Sydney). */
export const DEFAULT_TEST_COORDS = {longitude: 151.2093, latitude: -33.8688};

export type TestCoords = {longitude: number; latitude: number};

/**
 * Stub `navigator.geolocation.getCurrentPosition` to resolve immediately with a
 * fixed position.
 *
 * Headless Chrome has no location provider, and this suite runs WebDriver
 * Classic (`wdio:enforceWebDriverClassic`), so BiDi's `browser.emulate` is not
 * available. Capacitor's web Geolocation plugin reads
 * `navigator.geolocation.getCurrentPosition` at call time and passes the raw
 * position straight through, so shadowing the method in the page is enough and
 * needs no permission prompt.
 *
 * The stub lives on the current document, so re-apply it after any page reload.
 * `accuracy` and `timestamp` are numbers because the stored FAIMS position
 * schema requires them.
 */
export async function stubGeolocation(
  coords: TestCoords = DEFAULT_TEST_COORDS
): Promise<void> {
  await browser.execute(
    (longitude: number, latitude: number) => {
      const position = {
        coords: {
          longitude,
          latitude,
          accuracy: 5,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: 1700000000000,
      };
      navigator.geolocation.getCurrentPosition = (
        success: PositionCallback
      ) => {
        success(position as unknown as GeolocationPosition);
      };
    },
    coords.longitude,
    coords.latitude
  );
}
