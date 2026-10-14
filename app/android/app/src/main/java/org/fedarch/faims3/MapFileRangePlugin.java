package org.fedarch.faims3;

import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.IOException;
import java.io.RandomAccessFile;

/**
 * Reads one byte range from a file in the app files directory.
 *
 * Capacitor's Android local server answers Range with status 206 but does
 * not seek the stream, so fetch(convertFileSrc) cannot read a PMTiles
 * archive a tile at a time. This read never returns more than the
 * requested length, and never more than 2MB.
 */
@CapacitorPlugin(name = "MapFileRange")
public class MapFileRangePlugin extends Plugin {
    private static final int MAX_LENGTH = 2 * 1024 * 1024;

    @PluginMethod
    public void read(PluginCall call) {
        String path = call.getString("path");
        Integer offset = call.getInt("offset");
        Integer length = call.getInt("length");
        if (path == null || offset == null || length == null) {
            call.reject("A path, offset, and length are required.");
            return;
        }
        if (offset < 0 || length < 0 || length > MAX_LENGTH) {
            call.reject("Tile range is larger than 2MB.");
            return;
        }
        if (path.contains("..") || path.startsWith("/")) {
            call.reject("Invalid path.");
            return;
        }
        File file = new File(getContext().getFilesDir(), path);
        try (RandomAccessFile raf = new RandomAccessFile(file, "r")) {
            if (offset > raf.length()) {
                call.reject("Offset is past the end of the file.");
                return;
            }
            int toRead = (int) Math.min(length, raf.length() - offset);
            byte[] buffer = new byte[toRead];
            raf.seek(offset);
            raf.readFully(buffer);
            JSObject result = new JSObject();
            result.put("data", Base64.encodeToString(buffer, Base64.NO_WRAP));
            call.resolve(result);
        } catch (IOException e) {
            call.reject("Could not read the file range.", e);
        }
    }
}
