// SPDX-License-Identifier: Apache-2.0
/**
 * Byte-range reads for a local PMTiles archive.
 *
 * A tile load must not pull the whole file into the WebView. Callers reject
 * any response larger than the requested length. Capacitor's Android local
 * file server sets HTTP 206 but returns the stream from byte 0, and iOS can
 * drop Range or fail a custom-scheme fetch while offline. Native apps seek
 * with the MapFileRange plugin. Browsers read with Blob.slice.
 */

/** One tile or directory read. Larger than this is a whole-archive read. */
export const TILE_RANGE_MAX_BYTES = 2 * 1024 * 1024;

/** Read `length` bytes at `offset` from a local PMTiles archive. */
export type TileByteRead = (
  offset: number,
  length: number,
  signal?: AbortSignal
) => Promise<ArrayBuffer>;

/** Throw if a tile load was cancelled mid-pan. */
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Tile load aborted.', 'AbortError');
  }
}

/** Reject a range that is not a bounded tile-sized read. */
export function assertTileRange(offset: number, length: number): void {
  if (
    !Number.isInteger(offset) ||
    !Number.isInteger(length) ||
    offset < 0 ||
    length < 0
  ) {
    throw new Error('Tile range is invalid.');
  }
  if (length > TILE_RANGE_MAX_BYTES) {
    throw new Error('Tile range is larger than 2MB.');
  }
}

/** Slice a file or blob. Does not read bytes outside the range. */
export async function readBlobRange(
  blob: Blob,
  offset: number,
  length: number,
  signal?: AbortSignal
): Promise<ArrayBuffer> {
  assertTileRange(offset, length);
  throwIfAborted(signal);
  if (length === 0) {
    return new ArrayBuffer(0);
  }
  const slice = blob.slice(offset, offset + length);
  const bytes =
    typeof slice.arrayBuffer === 'function'
      ? await slice.arrayBuffer()
      : await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = () => reject(reader.error);
          reader.readAsArrayBuffer(slice);
        });
  if (bytes.byteLength > length) {
    throw new Error('Tile read returned more bytes than requested.');
  }
  return bytes;
}

/**
 * Range GET. Status 200, or a body longer than the request, is not a range
 * read — that is the Android convertFileSrc failure mode.
 */
export async function fetchByteRange(
  url: string,
  offset: number,
  length: number
): Promise<ArrayBuffer> {
  assertTileRange(offset, length);
  if (length === 0) {
    return new ArrayBuffer(0);
  }
  const response = await fetch(url, {
    headers: {Range: `bytes=${offset}-${offset + length - 1}`},
  });
  if (response.status !== 206) {
    throw new Error('Local file server did not honor the byte range.');
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > length) {
    throw new Error('Tile read returned more bytes than requested.');
  }
  return bytes;
}
