package org.fedarch.faims3;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Reports whether Android has the sensors Capgo Compass needs. */
@CapacitorPlugin(name = "AndroidCompassSensors")
public class AndroidCompassSensorsPlugin extends Plugin {
    /** Resolve whether both sensors required for Android compass readings exist. */
    @PluginMethod
    public void getAvailability(PluginCall call) {
        try {
            SensorManager sensors = (SensorManager) getContext()
                    .getSystemService(Context.SENSOR_SERVICE);
            if (sensors == null) {
                call.reject("Android sensor service is unavailable.");
                return;
            }

            JSObject result = new JSObject();
            result.put("accelerometerAvailable",
                    sensors.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) != null);
            result.put("magneticFieldAvailable",
                    sensors.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD) != null);
            call.resolve(result);
        } catch (RuntimeException error) {
            call.reject("Could not check Android compass sensors.", error);
        }
    }
}
