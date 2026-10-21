// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it, vi} from 'vitest';
import {fetchByteRange, readBlobRange} from './pmtilesRange';

describe('pmtiles range reads', () => {
  it('slices a blob without reading past the request', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])]);
    const bytes = new Uint8Array(await readBlobRange(blob, 2, 3));
    expect(Array.from(bytes)).toEqual([3, 4, 5]);
  });

  it('does not read after the tile load is aborted', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])]);
    const signal = AbortSignal.abort();
    await expect(readBlobRange(blob, 0, 2, signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('rejects a range larger than one tile read', async () => {
    const blob = new Blob([new Uint8Array(8)]);
    await expect(readBlobRange(blob, 0, 3 * 1024 * 1024)).rejects.toThrow(
      /2MB/
    );
  });

  it('rejects a 200 response, which is not a byte range', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      })
    );
    await expect(fetchByteRange('file://layer.pmtiles', 0, 2)).rejects.toThrow(
      /did not honor the byte range/
    );
    vi.unstubAllGlobals();
  });

  it('rejects a 206 body longer than the request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 206,
        arrayBuffer: async () => new Uint8Array(64).buffer,
      })
    );
    await expect(fetchByteRange('file://layer.pmtiles', 10, 4)).rejects.toThrow(
      /more bytes than requested/
    );
    vi.unstubAllGlobals();
  });

  it('accepts a 206 body of the requested length', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 206,
        arrayBuffer: async () => new Uint8Array([9, 8]).buffer,
      })
    );
    const bytes = new Uint8Array(
      await fetchByteRange('file://layer.pmtiles', 4, 2)
    );
    expect(Array.from(bytes)).toEqual([9, 8]);
    vi.unstubAllGlobals();
  });
});
