// SPDX-License-Identifier: Apache-2.0
/**
 * Native range read for a PMTiles file in Directory.Data.
 *
 * Android's WebView file server does not seek. iOS can drop the Range
 * header, and a custom-scheme fetch fails while the device is offline.
 * Both platforms seek through the MapFileRange plugin instead.
 *
 * The plugin writes the range to a Cache file and returns its URI. JS
 * fetches that file as an ArrayBuffer so tile bytes never cross the
 * Capacitor bridge as base64 JSON (which logged and copied every tile
 * during a pan and crashed iOS WebContent).
 */

import {Capacitor, registerPlugin} from '@capacitor/core';
import {assertTileRange, throwIfAborted} from '@faims3/forms';
import {createAsyncSemaphore} from '../../../utils/asyncMutex';

/** Concurrent native tile reads. Rapid pan used to fire dozens at once. */
export const NATIVE_FILE_RANGE_CONCURRENCY = 2;

const runLimitedRead = createAsyncSemaphore(NATIVE_FILE_RANGE_CONCURRENCY);

type MapFileRangePlugin = {
  read(options: {
    path: string;
    offset: number;
    length: number;
  }): Promise<{uri?: string; path?: string; data?: string; bytes?: number}>;
  remove(options: {path: string}): Promise<void>;
};

let plugin: MapFileRangePlugin | undefined;

/** Lazily registered Capacitor MapFileRange plugin. */
function mapFileRange(): MapFileRangePlugin {
  plugin ??= registerPlugin<MapFileRangePlugin>('MapFileRange');
  return plugin;
}

/** Decode a legacy plugin base64 payload into tile bytes. */
export function decodeBase64Tile(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Fetch the cache file the plugin wrote for this range. */
async function readRangeFile(
  uri: string,
  signal?: AbortSignal
): Promise<ArrayBuffer> {
  const response = await fetch(Capacitor.convertFileSrc(uri), {signal});
  if (!response.ok) {
    throw new Error('Could not read the tile range file.');
  }
  return response.arrayBuffer();
}

/** Path is relative to Directory.Data, for example map-assets/a.pmtiles. */
export async function readNativeFileRange(
  path: string,
  offset: number,
  length: number,
  signal?: AbortSignal
): Promise<ArrayBuffer> {
  assertTileRange(offset, length);
  throwIfAborted(signal);
  if (length === 0) {
    return new ArrayBuffer(0);
  }
  return runLimitedRead(async () => {
    throwIfAborted(signal);
    const result = await mapFileRange().read({path, offset, length});
    try {
      throwIfAborted(signal);
      const bytes = result.uri
        ? new Uint8Array(await readRangeFile(result.uri, signal))
        : result.data
          ? decodeBase64Tile(result.data)
          : undefined;
      if (!bytes) {
        throw new Error('Tile read returned no data.');
      }
      if (bytes.byteLength > length) {
        throw new Error('Tile read returned more bytes than requested.');
      }
      // The plugin may clamp to EOF. Compare against the bytes it wrote,
      // not the requested length, so a short-but-complete EOF read is fine.
      if (
        typeof result.bytes === 'number' &&
        Number.isFinite(result.bytes) &&
        bytes.byteLength !== result.bytes
      ) {
        throw new Error('Tile read returned an incomplete range.');
      }
      throwIfAborted(signal);
      return bytes.slice().buffer;
    } finally {
      if (result.path) {
        await mapFileRange()
          .remove({path: result.path})
          .catch(() => undefined);
      }
    }
  });
}
