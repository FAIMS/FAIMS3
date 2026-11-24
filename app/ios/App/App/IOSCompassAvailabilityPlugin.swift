import Capacitor
import CoreLocation

@objc(IOSCompassAvailabilityPlugin)
public class IOSCompassAvailabilityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "IOSCompassAvailabilityPlugin"
    public let jsName = "IOSCompassAvailability"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getAvailability", returnType: CAPPluginReturnPromise)
    ]

    @objc func getAvailability(_ call: CAPPluginCall) {
        call.resolve(["headingAvailable": CLLocationManager.headingAvailable()])
    }
}
