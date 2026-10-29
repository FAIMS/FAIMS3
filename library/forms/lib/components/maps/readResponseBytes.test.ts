// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {readResponseBlob, readResponseBytes} from './readResponseBytes';

const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

function chunkedResponse(data: Uint8Array, chunkSize: number): Response {
  let offset = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= data.byteLength) {
        controller.close();
        return;
      }
      const end = Math.min(offset + chunkSize, data.byteLength);
      controller.enqueue(data.subarray(offset, end));
      offset = end;
    },
  });
  return new Response(stream, {
    headers: {'Content-Length': String(data.byteLength)},
  });
}

describe('readResponseBytes', () => {
  it('reports chunk progress from the body stream', async () => {
    const updates: Array<[number, number]> = [];
    const result = await readResponseBytes(chunkedResponse(bytes, 3), {
      expectedBytes: bytes.byteLength,
      onReceived: (received, total) => updates.push([received, total]),
    });
    expect(result).toEqual(bytes);
    expect(updates).toEqual([
      [3, 8],
      [6, 8],
      [8, 8],
      [8, 8],
    ]);
  });

  it('uses the expected size when Content-Length is missing', async () => {
    const updates: Array<[number, number]> = [];
    const result = await readResponseBytes(new Response(bytes), {
      expectedBytes: 8,
      onReceived: (received, total) => updates.push([received, total]),
    });
    expect(result.byteLength).toBe(8);
    expect(updates.at(-1)).toEqual([8, 8]);
  });

  it('throws AbortError when the signal is already aborted', async () => {
    const signal = AbortSignal.abort();
    await expect(
      readResponseBytes(chunkedResponse(bytes, 3), {signal})
    ).rejects.toMatchObject({name: 'AbortError'});
  });
});

describe('readResponseBlob', () => {
  it('returns the same bytes as a Blob', async () => {
    const blob = await readResponseBlob(chunkedResponse(bytes, 3), {
      expectedBytes: bytes.byteLength,
    });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBe(bytes.byteLength);
  });
});
