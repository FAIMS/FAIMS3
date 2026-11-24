import Capacitor
import CoreLocation

/// Exposes iOS compass availability to the app without requesting permission.
@objc(IOSCompassAvailabilityPlugin)
public class IOSCompassAvailabilityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "IOSCompassAvailabilityPlugin"
    public let jsName = "IOSCompassAvailability"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getAvailability", returnType: CAPPluginReturnPromise)
    ]

    /// Check whether Core Location supports device heading updates.
    @objc func getAvailability(_ call: CAPPluginCall) {
        call.resolve(["headingAvailable": CLLocationManager.headingAvailable()])
    }
}
