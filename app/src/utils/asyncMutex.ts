// SPDX-License-Identifier: Apache-2.0

/**
 * Promise-queue mutex: each `runExclusive` waits for the previous job to finish
 * before running `fn`, so overlapping async work is serialized. A rejected
 * predecessor must not block the queue, hence `await prev.catch(() => {})`.
 */
export function createAsyncMutex() {
  let mutex = Promise.resolve();
  return async function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const prev = mutex;
    let resolveNext!: () => void;
    mutex = new Promise<void>(r => {
      resolveNext = r;
    });
    await prev.catch(() => {});
    try {
      return await fn();
    } finally {
      resolveNext();
    }
  };
}
