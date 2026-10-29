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

/**
 * At most `max` jobs run at once. Extra callers wait, then take a free slot.
 * A rejected job still releases its slot.
 */
export function createAsyncSemaphore(max: number) {
  if (max < 1 || !Number.isInteger(max)) {
    throw new Error('Semaphore max must be a positive integer.');
  }
  let active = 0;
  const waiters: Array<() => void> = [];
  const acquire = async () => {
    if (active >= max) {
      await new Promise<void>(resolve => {
        waiters.push(resolve);
      });
    }
    active += 1;
  };
  const release = () => {
    active -= 1;
    waiters.shift()?.();
  };
  return async function runLimited<T>(fn: () => Promise<T>): Promise<T> {
    await acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  };
}
