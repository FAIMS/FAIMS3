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
  createHeadingSmoothingState,
  isFiniteHeading,
  smoothHeadingSample,
  type HeadingSmoothingState,
} from '../components/maps/heading';
import {
  headingFromDeviceOrientation,
  screenOrientationAngle,
} from '../components/maps/webHeading';
import {getAndroidCompassSensorAvailability} from '../native/androidCompassSensors';
import {getIOSCompassAvailability} from '../native/iosCompassAvailability';
import {logWarn} from '../logging';

// Clear Android compass data after this long without a valid sensor update.
export const ANDROID_HEADING_STALE_AFTER_MS = 1500;
// Minimum heading change (in degrees) required to publish an update.
const HEADING_UPDATE_THRESHOLD_DEG = 0.05;

/** Live compass reading consumed by the map heading triangle. */
export interface DeviceHeading {
  // Smoothed heading in degrees, or null before a valid sensor reading.
  headingDeg: number | null;
  // Identifies compass data; null lets the map select its GPS fallback.
  source: 'compass' | null;
  // North reference used to decide whether magnetic declination is needed.
  reference: CompassReference | null;
  // iOS Safari permission request; call from a user gesture.
  requestWebPermission: () => void;
}

/** Heading fields sent to consumers when a compass sample changes. */
export type DeviceHeadingUpdate = Omit<DeviceHeading, 'requestWebPermission'>;

/**
 * Capgo iOS uses CLHeading.trueHeading. Android and the web APIs are
 * magnetic — MapComponent applies WMM declination for those.
 */
const NATIVE_REFERENCE: Record<'ios' | 'android', CompassReference> = {
  ios: 'true',
  android: 'magnetic',
};

type NativeHeadingListener = (heading: number) => void;

/** Handle returned after Capgo's heading listener is registered. */
interface NativeCompassSession {
  // Remove the event listener before stopping the sensor stream.
  remove: () => Promise<void>;
}

/**
 * Capgo start/stop is process-global. Ref-count so two maps can share one
 * sensor session, and so unmount during `startListening()` still stops it.
 */
const nativeHeadingListeners = new Set<NativeHeadingListener>();
let nativeStartPromise: Promise<NativeCompassSession | null> | null = null;
// Capgo start/stop is global: a new session must wait for the previous stop.
let nativeStopPromise: Promise<void> | null = null;
let androidSensorAvailabilityPromise: ReturnType<
  typeof getAndroidCompassSensorAvailability
> | null = null;

/** Check access, start Capgo's shared sensor listener, and return its handle. */
async function startNativeCompassSession(): Promise<NativeCompassSession | null> {
  const platform = Capacitor.getPlatform();

  if (platform === 'android') {
    try {
      // Capgo can produce plausible readings without a magnetometer, so check
      // the actual hardware before treating its output as a compass heading.
      androidSensorAvailabilityPromise ??=
        getAndroidCompassSensorAvailability();

      const availability = await androidSensorAvailabilityPromise;
      const missingSensors: string[] = [];
      if (!availability.accelerometerAvailable) {
        missingSensors.push('accelerometer');
      }
      if (!availability.magneticFieldAvailable) {
        missingSensors.push('magnetometer');
      }
      if (missingSensors.length > 0) {
        logWarn(
          `Android compass unavailable; missing ${missingSensors.join(' and ')}. Using GPS course-over-ground.`
        );
        return null;
      }
    } catch (error) {
      // A failed bridge check does not confirm missing hardware; retain the
      // existing Capgo startup path and report the check failure separately.
      logWarn(
        'Failed to check Android compass sensor availability; continuing with Capgo Compass:',
        error
      );
    }
  }

  if (platform === 'ios') {
    try {
      const availability = await getIOSCompassAvailability();
      if (!availability.headingAvailable) {
        logWarn(
          'iOS compass unavailable; device heading is not supported. Using GPS course-over-ground.'
        );
        return null;
      }
    } catch (error) {
      // A failed check does not confirm missing heading hardware.
      logWarn(
        'Failed to check iOS compass availability; continuing with Capgo Compass:',
        error
      );
    }
  }

  // Request access only when the platform reports a prompt state.
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

  // Disable this session's callback even if native listener removal fails.
  let active = true;
  // Forward only usable bearings to the maps sharing this native session.
  const handle = await CapgoCompass.addListener('headingChange', event => {
    if (!active || nativeStopPromise || !isFiniteHeading(event.value)) {
      return;
    }
    for (const listener of nativeHeadingListeners) {
      listener(event.value);
    }
  });
  try {
    // Remove the event listener if the sensor session fails to start.
    await CapgoCompass.startListening();
  } catch (error) {
    active = false;
    await handle.remove();
    throw error;
  }
  return {
    remove: async () => {
      active = false;
      await handle.remove();
    },
  };
}

/** Add a map to the shared sensor session and return a function to release it. */
async function subscribeNativeHeading(
  listener: NativeHeadingListener
): Promise<() => Promise<void>> {
  nativeHeadingListeners.add(listener);
  if (!nativeStartPromise) {
    nativeStartPromise = nativeStopPromise
      ? nativeStopPromise.then(startNativeCompassSession)
      : startNativeCompassSession();
  }

  /** Remove this map and stop the sensors when it was the last subscriber. */
  const release = async () => {
    if (!nativeHeadingListeners.has(listener)) {
      return;
    }
    nativeHeadingListeners.delete(listener);
    // Keep the shared sensor active until the last map releases its listener.
    if (nativeHeadingListeners.size > 0) {
      return;
    }
    const pending = nativeStartPromise;
    nativeStartPromise = null;
    if (!pending) {
      return;
    }

    // Publish the shutdown promise before yielding so new subscribers wait
    // until the previous native session has finished stopping.
    const stopping = (async () => {
      let handle: NativeCompassSession | null;
      try {
        handle = await pending;
      } catch {
        // Session never started; nothing to stop.
        return;
      }

      if (!handle) {
        return;
      }

      try {
        await handle.remove();
      } finally {
        // Still attempt to stop the sensors if listener removal fails.
        await CapgoCompass.stopListening();
      }
    })();

    // A failed shutdown should not permanently prevent future startup.
    const settled = stopping.catch(error => {
      logWarn('Failed to stop native compass:', error);
    });
    nativeStopPromise = settled;
    await settled;
    if (nativeStopPromise === settled) {
      nativeStopPromise = null;
    }
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
  nativeStopPromise = null;
  androidSensorAvailabilityPromise = null;
}

/**
 * Read and smooth compass updates while mounted.
 * @param onHeadingChange Optional callback for redraws without React rerenders.
 */
export function useDeviceHeading(
  onHeadingChange?: (heading: DeviceHeadingUpdate) => void
): DeviceHeading {
  const [headingDeg, setHeadingDeg] = useState<number | null>(null);
  const platform = Capacitor.getPlatform();
  const smoothingStateRef = useRef<HeadingSmoothingState>(
    createHeadingSmoothingState()
  );
  const lastPublishedHeadingRef = useRef<number | null>(null);
  const onHeadingChangeRef = useRef(onHeadingChange);
  onHeadingChangeRef.current = onHeadingChange;
  const ignoreInitialAndroidSampleRef = useRef(platform === 'android');
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const webPermissionRequestedRef = useRef(false);

  const reference: CompassReference | null =
    platform === 'ios' || platform === 'android'
      ? NATIVE_REFERENCE[platform]
      : platform === 'web'
        ? 'magnetic'
        : null;

  /** Send heading updates through the callback or the hook's React state. */
  const publishHeading = useCallback(
    (nextHeading: number | null) => {
      lastPublishedHeadingRef.current = nextHeading;
      const update: DeviceHeadingUpdate = {
        headingDeg: nextHeading,
        source: nextHeading == null ? null : 'compass',
        reference: nextHeading == null ? null : reference,
      };
      // Maps can redraw from the callback without rerendering the hook's owner.
      if (onHeadingChangeRef.current) {
        onHeadingChangeRef.current(update);
      } else {
        setHeadingDeg(nextHeading);
      }
    },
    [reference]
  );

  /** Clear Android's heading after updates stop so the map can use GPS. */
  const armAndroidStaleTimer = useCallback(() => {
    if (platform !== 'android') {
      return;
    }

    if (staleTimerRef.current !== null) {
      clearTimeout(staleTimerRef.current);
    }

    staleTimerRef.current = setTimeout(() => {
      staleTimerRef.current = null;
      // Let the map fall back to GPS if Android stops delivering compass events.
      smoothingStateRef.current = createHeadingSmoothingState();
      ignoreInitialAndroidSampleRef.current = true;
      publishHeading(null);
    }, ANDROID_HEADING_STALE_AFTER_MS);
  }, [platform, publishHeading]);

  /** Validate, warm up, smooth, and publish one compass sample. */
  const receiveHeading = useCallback(
    (heading: number) => {
      if (!isFiniteHeading(heading)) {
        return;
      }
      armAndroidStaleTimer();
      if (platform === 'android' && ignoreInitialAndroidSampleRef.current) {
        // Capgo v7 may calculate its first event before both sensor vectors
        // have been populated. Discard one Android sample during warm-up.
        ignoreInitialAndroidSampleRef.current = false;
        return;
      }

      const before = smoothingStateRef.current;
      // Use elapsed monotonic time so uneven sensor intervals smooth consistently.
      const after = smoothHeadingSample(before, heading, performance.now());
      smoothingStateRef.current = after;
      // Compare with the last published heading so small changes accumulate.
      const lastPublished = lastPublishedHeadingRef.current;
      if (
        after.headingDeg != null &&
        (lastPublished == null ||
          Math.abs(((after.headingDeg - lastPublished + 540) % 360) - 180) >=
            HEADING_UPDATE_THRESHOLD_DEG)
      ) {
        publishHeading(after.headingDeg);
      }
    },
    [armAndroidStaleTimer, platform, publishHeading]
  );

  /** Listen to browser orientation events and return a cleanup function. */
  const startWebCompass = useCallback(() => {
    /** Convert a browser event to a usable bearing and pass it to the filter. */
    const handleOrientation = (event: DeviceOrientationEvent) => {
      const heading = headingFromDeviceOrientation(
        event,
        screenOrientationAngle()
      );
      if (!isFiniteHeading(heading)) {
        return;
      }
      receiveHeading(heading);
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
  }, [receiveHeading]);

  /** Request browser compass access once, from a user gesture on iOS Safari. */
  const requestWebPermission = useCallback(() => {
    if (
      Capacitor.getPlatform() !== 'web' ||
      webPermissionRequestedRef.current
    ) {
      return;
    }
    webPermissionRequestedRef.current = true;

    // Only some browsers require an explicit, gesture-triggered permission call.
    const OrientationEvent = window.DeviceOrientationEvent as
      | (typeof DeviceOrientationEvent & {
          requestPermission?: () => Promise<PermissionState>;
        })
      | undefined;

    // Other browsers do not expose this permission API and need no prompt.
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

  /** Start the platform compass listener and stop it when this hook unmounts. */
  useEffect(() => {
    let cancelled = false;
    let removeWeb: (() => void) | undefined;
    let releaseNative: (() => Promise<void>) | undefined;

    /** Join the shared native session and release it if this hook unmounts. */
    const startNative = async () => {
      try {
        const subscribe = subscribeNativeHeading(heading => {
          if (!cancelled) {
            receiveHeading(heading);
          }
        });
        // Assigned before awaiting start so unmount during startListening
        // still releases (and stops sensors if this was the last map).
        /** Release this map's subscription after startup completes. */
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

    /** Clear timers and release this map's sensor subscription on unmount. */
    return () => {
      cancelled = true;
      removeWeb?.();
      if (platform === 'android') {
        ignoreInitialAndroidSampleRef.current = true;
      }
      if (staleTimerRef.current !== null) {
        clearTimeout(staleTimerRef.current);
        staleTimerRef.current = null;
      }
      void releaseNative?.().catch(error => {
        logWarn('Failed to stop native compass:', error);
      });
    };
  }, [platform, receiveHeading, startWebCompass]);

  return {
    headingDeg,
    source: headingDeg == null ? null : 'compass',
    reference: headingDeg == null ? null : reference,
    requestWebPermission,
  };
}
