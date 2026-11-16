import Capacitor

/// App bridge. Registers the local PMTiles range reader before the web view loads.
class FAIMSBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(MapFileRangePlugin())
    }
}
