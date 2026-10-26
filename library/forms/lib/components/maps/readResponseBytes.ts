// SPDX-License-Identifier: Apache-2.0

export type ReadResponseBytesOptions = {
  expectedBytes?: number;
  onReceived?: (received: number, total: number) => void;
  signal?: AbortSignal;
};

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) {
    return;
  }
  const reason = signal.reason;
  if (reason instanceof Error) {
    throw reason;
  }
  throw new DOMException('The operation was aborted.', 'AbortError');
}

/**
 * Read a response body in chunks so the caller can show download progress.
 * Falls back to the full buffer when the body stream is unavailable.
 */
export async function readResponseBytes(
  response: Response,
  {
    expectedBytes = 0,
    onReceived = () => undefined,
    signal,
  }: ReadResponseBytesOptions = {}
): Promise<Uint8Array> {
  throwIfAborted(signal);
  const headerLength = Number(response.headers.get('Content-Length'));
  const total =
    Number.isFinite(headerLength) && headerLength > 0
      ? headerLength
      : expectedBytes;
  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    onReceived(bytes.byteLength, Math.max(total, bytes.byteLength));
    return bytes;
  }
  const abortRead = () => {
    void reader.cancel();
  };
  signal?.addEventListener('abort', abortRead, {once: true});
  try {
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      throwIfAborted(signal);
      const {done, value} = await reader.read();
      if (done) {
        break;
      }
      if (!value) {
        continue;
      }
      chunks.push(value);
      received += value.byteLength;
      onReceived(received, Math.max(total, received));
    }
    throwIfAborted(signal);
    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    onReceived(bytes.byteLength, Math.max(total, bytes.byteLength));
    return bytes;
  } finally {
    signal?.removeEventListener('abort', abortRead);
  }
}

/** Same as {@link readResponseBytes}, packaged as a Blob. */
export async function readResponseBlob(
  response: Response,
  options: ReadResponseBytesOptions = {}
): Promise<Blob> {
  const bytes = await readResponseBytes(response, options);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer]);
}
