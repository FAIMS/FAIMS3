// SPDX-License-Identifier: Apache-2.0
/**
 * Native range read for a PMTiles file in Directory.Data.
 *
 * Android's WebView file server does not seek. iOS can drop the Range
 * header, and a custom-scheme fetch fails while the device is offline.
 * Both platforms seek through the MapFileRange plugin instead.
 */

import {registerPlugin} from '@capacitor/core';
import {assertTileRange} from '@faims3/forms';

type MapFileRangePlugin = {
  read(options: {
    path: string;
    offset: number;
    length: number;
  }): Promise<{data: string}>;
};

let plugin: MapFileRangePlugin | undefined;

/** Lazily registered Capacitor MapFileRange plugin. */
function mapFileRange(): MapFileRangePlugin {
  plugin ??= registerPlugin<MapFileRangePlugin>('MapFileRange');
  return plugin;
}

/** Decode the plugin's base64 payload into tile bytes. */
export function decodeBase64Tile(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Path is relative to Directory.Data, for example map-assets/a.pmtiles. */
export async function readNativeFileRange(
  path: string,
  offset: number,
  length: number
): Promise<ArrayBuffer> {
  assertTileRange(offset, length);
  const {data} = await mapFileRange().read({path, offset, length});
  const bytes = decodeBase64Tile(data);
  if (bytes.byteLength > length) {
    throw new Error('Tile read returned more bytes than requested.');
  }
  return bytes.slice().buffer;
}
