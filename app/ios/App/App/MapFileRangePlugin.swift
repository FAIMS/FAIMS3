import Capacitor
import Foundation

/**
 * Reads one byte range from a file in the app Documents directory.
 *
 * That is Capacitor Directory.Data on iOS. Tile loads must not fetch the
 * archive: WebKit can drop the Range header, and a custom-scheme fetch fails
 * when the device is offline. Bytes are written to a Cache file so JS can
 * fetch an ArrayBuffer. They never cross the Capacitor bridge as base64.
 * This read never returns more than the requested length, and never more
 * than 2MB.
 */
@objc(MapFileRangePlugin)
public class MapFileRangePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MapFileRangePlugin"
    public let jsName = "MapFileRange"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise)
    ]

    private static let maxLength = 2 * 1024 * 1024
    private static let tempFolder = "map-range"

    override public func load() {
        sweepTempTiles()
    }

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
        guard let fileURL = validatedDataURL(path),
              let cache = cacheRoot() else {
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
            let relative = "\(MapFileRangePlugin.tempFolder)/\(UUID().uuidString).tile"
            let tmpURL = cache.appendingPathComponent(relative)
            try FileManager.default.createDirectory(
                at: tmpURL.deletingLastPathComponent(),
                withIntermediateDirectories: true
            )
            try data.write(to: tmpURL, options: .atomic)
            call.resolve([
                "path": relative,
                "uri": tmpURL.absoluteString,
                "bytes": data.count
            ])
        } catch {
            call.reject("Could not read the file range.", nil, error)
        }
    }

    @objc func remove(_ call: CAPPluginCall) {
        guard let path = call.getString("path"),
              let tmpURL = validatedTempURL(path) else {
            call.reject("Invalid path.")
            return
        }
        try? FileManager.default.removeItem(at: tmpURL)
        call.resolve()
    }

    private func cacheRoot() -> URL? {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first
    }

    private func validatedDataURL(_ path: String) -> URL? {
        if path.contains("..") || path.hasPrefix("/") {
            return nil
        }
        guard let documents = FileManager.default.urls(
            for: .documentDirectory,
            in: .userDomainMask
        ).first else {
            return nil
        }
        let root = documents.standardizedFileURL
        let fileURL = documents.appendingPathComponent(path).standardizedFileURL
        if fileURL.path != root.path && !fileURL.path.hasPrefix(root.path + "/") {
            return nil
        }
        return fileURL
    }

    private func validatedTempURL(_ path: String) -> URL? {
        if path.contains("..") || path.hasPrefix("/") {
            return nil
        }
        if !path.hasPrefix(MapFileRangePlugin.tempFolder + "/") {
            return nil
        }
        guard let cache = cacheRoot() else {
            return nil
        }
        let folder = cache.appendingPathComponent(MapFileRangePlugin.tempFolder)
            .standardizedFileURL
        let fileURL = cache.appendingPathComponent(path).standardizedFileURL
        if !fileURL.path.hasPrefix(folder.path + "/") {
            return nil
        }
        return fileURL
    }

    private func sweepTempTiles() {
        guard let cache = cacheRoot() else {
            return
        }
        let folder = cache.appendingPathComponent(MapFileRangePlugin.tempFolder)
        try? FileManager.default.removeItem(at: folder)
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
