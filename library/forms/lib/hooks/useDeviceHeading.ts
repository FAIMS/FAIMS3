// SPDX-License-Identifier: Apache-2.0

/*
 * Description:
 *   Subscribe to the device compass for the life of a mounted map.
 *
 *   Native (iOS/Android): @capgo/capacitor-compass v7. iOS CoreLocation
 *   reports true heading; Android accel+magnetometer reports magnetic
 *   heading. v7 `startListening()` has no throttle options (those are
 *   v8). Android sensor access needs no extra permission; iOS heading
 *   uses the same location permission as GPS.
 *
 *   Web: DeviceOrientationEvent. iOS Safari only starts after
 *   `requestPermission()` from a user gesture — MapComponent calls
 *   `requestWebPermission` on pointer down. Desktop usually yields
 *   nothing; GPS heading remains the fallback.
 *
 *   Capgo start/stop is process-global, so maps share one ref-counted
 *   session. Unmount during `startListening()` still stops the sensors.
 *   Failures are non-fatal.
 */

import {Capacitor} from '@capacitor/core';
import {CapgoCompass} from '@capgo/capacitor-compass';
import {useCallback, useEffect, useRef, useState} from 'react';
import {
  CompassReference,
  isFiniteHeading,
  smoothHeading,
} from '../components/maps/heading';
import {
  headingFromDeviceOrientation,
  screenOrientationAngle,
} from '../components/maps/webHeading';
import {logWarn} from '../logging';

/** Live compass reading consumed by the map heading triangle. */
export interface DeviceHeading {
  /** Smoothed heading in degrees, or null if the sensor has not reported. */
  headingDeg: number | null;
  /** Present only while `headingDeg` is set, so GPS fallback is not labelled compass. */
  source: 'compass' | null;
  /**
   * North reference of `headingDeg`. Null until a compass sample arrives so
   * declination is not applied to a GPS fallback heading.
   */
  reference: CompassReference | null;
  /** iOS Safari: must run from a user gesture. No-op on native / after the first call. */
  requestWebPermission: () => void;
}

/**
 * Capgo iOS uses CLHeading.trueHeading. Android and the web APIs are
 * magnetic — MapComponent applies WMM declination for those.
 */
const NATIVE_REFERENCE: Record<'ios' | 'android', CompassReference> = {
  ios: 'true',
  android: 'magnetic',
};

function applyHeading(
  next: number,
  previous: number | null,
  setHeading: (value: number) => void
): number {
  const smoothed = smoothHeading(previous, next);
  setHeading(smoothed);
  return smoothed;
}

type NativeHeadingListener = (heading: number) => void;

/**
 * Capgo start/stop is process-global. Ref-count so two maps can share one
 * sensor session, and so unmount during `startListening()` still stops it.
 */
const nativeHeadingListeners = new Set<NativeHeadingListener>();
let nativeStartPromise: Promise<{remove: () => Promise<void>}> | null = null;

async function startNativeCompassSession(): Promise<{
  remove: () => Promise<void>;
}> {
  const current = await CapgoCompass.checkPermissions();
  if (
    current.compass === 'prompt' ||
    current.compass === 'prompt-with-rationale'
  ) {
    const requested = await CapgoCompass.requestPermissions();
    if (requested.compass !== 'granted') {
      throw new Error('Compass permission was not granted');
    }
  } else if (current.compass === 'denied') {
    throw new Error('Compass permission denied');
  }

  const handle = await CapgoCompass.addListener('headingChange', event => {
    if (!isFiniteHeading(event.value)) {
      return;
    }
    for (const listener of nativeHeadingListeners) {
      listener(event.value);
    }
  });
  try {
    await CapgoCompass.startListening();
  } catch (error) {
    await handle.remove();
    throw error;
  }
  return handle;
}

async function subscribeNativeHeading(
  listener: NativeHeadingListener
): Promise<() => Promise<void>> {
  nativeHeadingListeners.add(listener);
  if (!nativeStartPromise) {
    nativeStartPromise = startNativeCompassSession();
  }

  const release = async () => {
    if (!nativeHeadingListeners.has(listener)) {
      return;
    }
    nativeHeadingListeners.delete(listener);
    if (nativeHeadingListeners.size > 0) {
      return;
    }
    const pending = nativeStartPromise;
    nativeStartPromise = null;
    if (!pending) {
      return;
    }
    let handle: {remove: () => Promise<void>};
    try {
      handle = await pending;
    } catch {
      // Session never started; nothing to stop.
      return;
    }
    await handle.remove();
    await CapgoCompass.stopListening();
  };

  try {
    await nativeStartPromise;
  } catch (error) {
    await release();
    throw error;
  }

  return release;
}

/** Test-only: drop leaked native subscribers between cases. */
export function resetNativeCompassForTests(): void {
  nativeHeadingListeners.clear();
  nativeStartPromise = null;
}

/**
 * Live device compass while mounted. Native uses Capgo; web uses
 * DeviceOrientation. Returns null heading until the first good sample.
 */
export function useDeviceHeading(): DeviceHeading {
  const [headingDeg, setHeadingDeg] = useState<number | null>(null);
  const smoothedRef = useRef<number | null>(null);
  const webPermissionRequestedRef = useRef(false);

  const platform = Capacitor.getPlatform();
  const reference: CompassReference | null =
    platform === 'ios' || platform === 'android'
      ? NATIVE_REFERENCE[platform]
      : platform === 'web'
        ? 'magnetic'
        : null;

  const startWebCompass = useCallback(() => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      const heading = headingFromDeviceOrientation(
        event,
        screenOrientationAngle()
      );
      if (!isFiniteHeading(heading)) {
        return;
      }
      smoothedRef.current = applyHeading(
        heading,
        smoothedRef.current,
        setHeadingDeg
      );
    };

    // Chrome Android fires the non-standard absolute event; Safari uses
    // deviceorientation + webkitCompassHeading. Listen to both.
    const absoluteName = 'deviceorientationabsolute';
    window.addEventListener(
      absoluteName as 'deviceorientation',
      handleOrientation,
      true
    );
    window.addEventListener('deviceorientation', handleOrientation, true);

    return () => {
      window.removeEventListener(
        absoluteName as 'deviceorientation',
        handleOrientation,
        true
      );
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, []);

  const requestWebPermission = useCallback(() => {
    if (
      Capacitor.getPlatform() !== 'web' ||
      webPermissionRequestedRef.current
    ) {
      return;
    }
    webPermissionRequestedRef.current = true;

    const OrientationEvent = window.DeviceOrientationEvent as
      | (typeof DeviceOrientationEvent & {
          requestPermission?: () => Promise<PermissionState>;
        })
      | undefined;

    if (typeof OrientationEvent?.requestPermission === 'function') {
      void OrientationEvent.requestPermission()
        .then(state => {
          if (state !== 'granted') {
            logWarn('Device orientation permission was not granted');
          }
        })
        .catch((error: unknown) => {
          logWarn('Failed to request device orientation permission:', error);
        });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let removeWeb: (() => void) | undefined;
    let releaseNative: (() => Promise<void>) | undefined;

    const startNative = async () => {
      try {
        const subscribe = subscribeNativeHeading(heading => {
          smoothedRef.current = applyHeading(
            heading,
            smoothedRef.current,
            setHeadingDeg
          );
        });
        // Assigned before awaiting start so unmount during startListening
        // still releases (and stops sensors if this was the last map).
        releaseNative = async () => {
          let release: (() => Promise<void>) | undefined;
          try {
            release = await subscribe;
          } catch {
            // Start failed; subscribeNativeHeading already released.
            return;
          }
          await release();
        };
        await subscribe;
        if (cancelled) {
          await releaseNative();
        }
      } catch (error) {
        if (!cancelled) {
          logWarn('Failed to start native compass:', error);
        }
      }
    };

    if (platform === 'ios' || platform === 'android') {
      void startNative();
    } else if (platform === 'web') {
      removeWeb = startWebCompass();
    }

    return () => {
      cancelled = true;
      removeWeb?.();
      void releaseNative?.().catch(error => {
        logWarn('Failed to stop native compass:', error);
      });
    };
  }, [platform, startWebCompass]);

  return {
    headingDeg,
    source: headingDeg == null ? null : 'compass',
    reference: headingDeg == null ? null : reference,
    requestWebPermission,
  };
}
