import Capacitor

/// App bridge. Registers local native plugins before the web view loads.
class FAIMSBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        // Register the native PMTiles file range reader.
        bridge?.registerPluginInstance(MapFileRangePlugin())
        // Register the iOS compass availability checker.
        bridge?.registerPluginInstance(IOSCompassAvailabilityPlugin())
    }
}