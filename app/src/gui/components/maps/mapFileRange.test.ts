// SPDX-License-Identifier: Apache-2.0
import {beforeEach, describe, expect, it, vi} from 'vitest';

const native = vi.hoisted(() => ({
  read: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    convertFileSrc: (uri: string) => `converted:${uri}`,
  },
  registerPlugin: () => native,
}));

import {
  decodeBase64Tile,
  NATIVE_FILE_RANGE_CONCURRENCY,
  readNativeFileRange,
} from './mapFileRange';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('decodeBase64Tile', () => {
  it('round-trips a short range', () => {
    const encoded = btoa(String.fromCharCode(1, 2, 3, 255));
    expect(Array.from(decodeBase64Tile(encoded))).toEqual([1, 2, 3, 255]);
  });
});

describe('readNativeFileRange', () => {
  beforeEach(() => {
    native.read.mockReset();
    native.remove.mockReset().mockResolvedValue(undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => Uint8Array.from([9, 8, 7]).buffer,
      }))
    );
  });

  it('fetches the cache file instead of decoding base64', async () => {
    native.read.mockResolvedValue({
      uri: 'file:///tmp/map-range/a.tile',
      path: 'map-range/a.tile',
    });

    const bytes = await readNativeFileRange('map-assets/a.pmtiles', 0, 16);

    expect(Array.from(new Uint8Array(bytes))).toEqual([9, 8, 7]);
    expect(fetch).toHaveBeenCalledWith(
      'converted:file:///tmp/map-range/a.tile',
      {signal: undefined}
    );
    expect(native.remove).toHaveBeenCalledWith({path: 'map-range/a.tile'});
  });

  it('falls back to a legacy base64 payload', async () => {
    native.read.mockResolvedValue({
      data: btoa(String.fromCharCode(4, 5, 6)),
    });

    const bytes = await readNativeFileRange('map-assets/a.pmtiles', 0, 16);
    expect(Array.from(new Uint8Array(bytes))).toEqual([4, 5, 6]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('removes the cache file when fetch fails', async () => {
    native.read.mockResolvedValue({
      uri: 'file:///tmp/map-range/a.tile',
      path: 'map-range/a.tile',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ok: false}))
    );

    await expect(
      readNativeFileRange('map-assets/a.pmtiles', 0, 16)
    ).rejects.toThrow('Could not read the tile range file.');
    expect(native.remove).toHaveBeenCalledWith({path: 'map-range/a.tile'});
  });

  it('skips the plugin when the tile load is already aborted', async () => {
    await expect(
      readNativeFileRange(
        'map-assets/a.pmtiles',
        0,
        16,
        AbortSignal.abort()
      )
    ).rejects.toMatchObject({name: 'AbortError'});
    expect(native.read).not.toHaveBeenCalled();
  });

  it('removes the cache file when the load is aborted after the plugin write', async () => {
    const controller = new AbortController();
    native.read.mockImplementation(async () => {
      controller.abort();
      return {
        uri: 'file:///tmp/map-range/a.tile',
        path: 'map-range/a.tile',
      };
    });

    await expect(
      readNativeFileRange('map-assets/a.pmtiles', 0, 16, controller.signal)
    ).rejects.toMatchObject({name: 'AbortError'});
    expect(native.remove).toHaveBeenCalledWith({path: 'map-range/a.tile'});
  });

  it('caps concurrent native reads', async () => {
    let current = 0;
    let max = 0;
    native.read.mockImplementation(async () => {
      current += 1;
      max = Math.max(max, current);
      await delay(15);
      current -= 1;
      return {uri: 'file:///tmp/map-range/a.tile', path: 'map-range/a.tile'};
    });

    await Promise.all(
      Array.from({length: NATIVE_FILE_RANGE_CONCURRENCY + 4}, () =>
        readNativeFileRange('map-assets/a.pmtiles', 0, 3)
      )
    );

    expect(max).toBe(NATIVE_FILE_RANGE_CONCURRENCY);
  });
});
