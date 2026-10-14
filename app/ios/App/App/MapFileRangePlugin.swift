import Capacitor
import Foundation

/**
 * Reads one byte range from a file in the app Documents directory.
 *
 * That is Capacitor Directory.Data on iOS. Tile loads must not fetch the
 * archive: WebKit can drop the Range header, and a custom-scheme fetch fails
 * when the device is offline. This read never returns more than the
 * requested length, and never more than 2MB.
 */
@objc(MapFileRangePlugin)
public class MapFileRangePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MapFileRangePlugin"
    public let jsName = "MapFileRange"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise)
    ]

    private static let maxLength = 2 * 1024 * 1024

    @objc func read(_ call: CAPPluginCall) {
        guard let path = call.getString("path"),
              let offset = wholeNumber(call, key: "offset"),
              let length = wholeNumber(call, key: "length") else {
            call.reject("A path, offset, and length are required.")
            return
        }
        if offset < 0 || length < 0 || length > MapFileRangePlugin.maxLength {
            call.reject("Tile range is larger than 2MB.")
            return
        }
        if path.contains("..") || path.hasPrefix("/") {
            call.reject("Invalid path.")
            return
        }
        guard let documents = FileManager.default.urls(
            for: .documentDirectory,
            in: .userDomainMask
        ).first else {
            call.reject("Could not read the file range.")
            return
        }
        let root = documents.standardizedFileURL
        let fileURL = documents.appendingPathComponent(path).standardizedFileURL
        let rootPath = root.path
        if fileURL.path != rootPath && !fileURL.path.hasPrefix(rootPath + "/") {
            call.reject("Invalid path.")
            return
        }
        do {
            let handle = try FileHandle(forReadingFrom: fileURL)
            defer { try? handle.close() }
            let size = try handle.seekToEnd()
            if UInt64(offset) > size {
                call.reject("Offset is past the end of the file.")
                return
            }
            let toRead = min(Int(length), Int(size - UInt64(offset)))
            try handle.seek(toOffset: UInt64(offset))
            var data = Data()
            data.reserveCapacity(toRead)
            while data.count < toRead {
                let chunk = handle.readData(ofLength: toRead - data.count)
                if chunk.isEmpty {
                    break
                }
                data.append(chunk)
            }
            if data.count != toRead {
                call.reject("Could not read the file range.")
                return
            }
            call.resolve(["data": data.base64EncodedString()])
        } catch {
            call.reject("Could not read the file range.", nil, error)
        }
    }

    /// JS numbers arrive as Int or Double. Both fit a byte offset.
    private func wholeNumber(_ call: CAPPluginCall, key: String) -> Int64? {
        if let value = call.getInt(key) {
            return Int64(value)
        }
        guard let value = call.getDouble(key),
              value >= 0,
              value <= Double(Int64.max),
              value == value.rounded() else {
            return nil
        }
        return Int64(value)
    }
}
