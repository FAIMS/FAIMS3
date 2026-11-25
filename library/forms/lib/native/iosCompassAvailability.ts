// SPDX-License-Identifier: Apache-2.0
import {registerPlugin} from '@capacitor/core';

interface IOSCompassAvailability {
  // Whether Core Location can provide device heading updates.
  headingAvailable: boolean;
}

interface IOSCompassAvailabilityPlugin {
  // Check for heading hardware without requesting location permission.
  getAvailability: () => Promise<IOSCompassAvailability>;
}

let plugin: IOSCompassAvailabilityPlugin | undefined;

/** Lazily registered Capacitor iOS compass availability plugin. */
function iosCompassAvailability(): IOSCompassAvailabilityPlugin {
  plugin ??= registerPlugin<IOSCompassAvailabilityPlugin>(
    'IOSCompassAvailability'
  );
  return plugin;
}

/** Check whether iOS supports device heading updates. */
export function getIOSCompassAvailability(): Promise<IOSCompassAvailability> {
  return iosCompassAvailability().getAvailability();
}
