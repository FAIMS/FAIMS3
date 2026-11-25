// SPDX-License-Identifier: Apache-2.0
import {registerPlugin} from '@capacitor/core';

/** Availability of the hardware sensors used by Android compass readings. */
export interface AndroidCompassSensorAvailability {
  // Whether Android reports an accelerometer.
  accelerometerAvailable: boolean;
  // Whether Android reports a magnetic-field sensor.
  magneticFieldAvailable: boolean;
}

interface AndroidCompassSensorsPlugin {
  // Read sensor availability from Android's SensorManager.
  getAvailability: () => Promise<AndroidCompassSensorAvailability>;
}

let plugin: AndroidCompassSensorsPlugin | undefined;

/** Lazily registered Capacitor Android compass sensor plugin. */
function androidCompassSensors(): AndroidCompassSensorsPlugin {
  plugin ??= registerPlugin<AndroidCompassSensorsPlugin>(
    'AndroidCompassSensors'
  );
  return plugin;
}

/** Read the Android sensors required to calculate a compass heading. */
export function getAndroidCompassSensorAvailability(): Promise<AndroidCompassSensorAvailability> {
  return androidCompassSensors().getAvailability();
}
