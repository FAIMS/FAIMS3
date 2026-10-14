// SPDX-License-Identifier: Apache-2.0
/**
 * Android range read for a PMTiles file in Directory.Data.
 *
 * iOS uses fetchByteRange on convertFileSrc: WebViewAssetHandler seeks.
 * Android's WebViewLocalServer does not, so this plugin seeks instead.
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

function mapFileRange(): MapFileRangePlugin {
  plugin ??= registerPlugin<MapFileRangePlugin>('MapFileRange');
  return plugin;
}

export function decodeBase64Tile(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Path is relative to the app files directory, for example map-assets/a.pmtiles. */
export async function readAndroidFileRange(
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
