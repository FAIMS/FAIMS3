package org.fedarch.faims3;

import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.util.UUID;

/**
 * Reads one byte range from a file in the app files directory.
 *
 * Capacitor's Android local server answers Range with status 206 but does
 * not seek the stream, so fetch(convertFileSrc) cannot read a PMTiles
 * archive a tile at a time. Bytes are written to a cache file so JS can
 * fetch an ArrayBuffer. They never cross the Capacitor bridge as base64.
 * This read never returns more than the requested length, and never more
 * than 2MB.
 */
@CapacitorPlugin(name = "MapFileRange")
public class MapFileRangePlugin extends Plugin {
    private static final int MAX_LENGTH = 2 * 1024 * 1024;
    private static final String TEMP_FOLDER = "map-range";

    @Override
    public void load() {
        sweepTempTiles();
    }

    @PluginMethod
    public void read(PluginCall call) {
        String path = call.getString("path");
        Long offset = wholeNumber(call, "offset");
        Long length = wholeNumber(call, "length");
        if (path == null || offset == null || length == null) {
            call.reject("A path, offset, and length are required.");
            return;
        }
        if (offset < 0 || length < 0 || length > MAX_LENGTH) {
            call.reject("Tile range is larger than 2MB.");
            return;
        }
        File file = validatedDataFile(path);
        if (file == null) {
            call.reject("Invalid path.");
            return;
        }
        try (RandomAccessFile raf = new RandomAccessFile(file, "r")) {
            if (offset > raf.length()) {
                call.reject("Offset is past the end of the file.");
                return;
            }
            int toRead = (int) Math.min(length, raf.length() - offset);
            byte[] buffer = new byte[toRead];
            raf.seek(offset);
            raf.readFully(buffer);
            String relative = TEMP_FOLDER + "/" + UUID.randomUUID() + ".tile";
            File tmp = new File(getContext().getCacheDir(), relative);
            File parent = tmp.getParentFile();
            if (parent != null && !parent.exists() && !parent.mkdirs()) {
                call.reject("Could not read the file range.");
                return;
            }
            try (FileOutputStream out = new FileOutputStream(tmp)) {
                out.write(buffer);
            }
            JSObject result = new JSObject();
            result.put("path", relative);
            result.put("uri", Uri.fromFile(tmp).toString());
            call.resolve(result);
        } catch (IOException e) {
            call.reject("Could not read the file range.", e);
        }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String path = call.getString("path");
        File tmp = validatedTempFile(path);
        if (tmp == null) {
            call.reject("Invalid path.");
            return;
        }
        //noinspection ResultOfMethodCallIgnored
        tmp.delete();
        call.resolve();
    }

    private File validatedDataFile(String path) {
        if (path == null || path.contains("..") || path.startsWith("/")) {
            return null;
        }
        File root = getContext().getFilesDir();
        File file = new File(root, path);
        try {
            String rootPath = root.getCanonicalPath();
            String filePath = file.getCanonicalPath();
            if (!filePath.equals(rootPath) && !filePath.startsWith(rootPath + File.separator)) {
                return null;
            }
        } catch (IOException e) {
            return null;
        }
        return file;
    }

    private File validatedTempFile(String path) {
        if (path == null || path.contains("..") || path.startsWith("/")) {
            return null;
        }
        if (!path.startsWith(TEMP_FOLDER + "/")) {
            return null;
        }
        File folder = new File(getContext().getCacheDir(), TEMP_FOLDER);
        File file = new File(getContext().getCacheDir(), path);
        try {
            String folderPath = folder.getCanonicalPath();
            String filePath = file.getCanonicalPath();
            if (!filePath.startsWith(folderPath + File.separator)) {
                return null;
            }
        } catch (IOException e) {
            return null;
        }
        return file;
    }

    private void sweepTempTiles() {
        File folder = new File(getContext().getCacheDir(), TEMP_FOLDER);
        deleteRecursively(folder);
    }

    private static void deleteRecursively(File file) {
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) {
                    deleteRecursively(child);
                }
            }
        }
        //noinspection ResultOfMethodCallIgnored
        file.delete();
    }

    /**
     * JS numbers arrive as Integer, Long, or Double. Each Capacitor getter
     * accepts only one of those types, so a byte offset needs all three.
     */
    private static Long wholeNumber(PluginCall call, String key) {
        Integer asInt = call.getInt(key);
        if (asInt != null) {
            return asInt.longValue();
        }
        Long asLong = call.getLong(key);
        if (asLong != null) {
            return asLong;
        }
        Double asDouble = call.getDouble(key);
        if (asDouble == null
                || asDouble < 0d
                || asDouble > (double) Long.MAX_VALUE
                || asDouble != Math.rint(asDouble)) {
            return null;
        }
        return asDouble.longValue();
    }
}
