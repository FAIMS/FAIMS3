// Copyright 2026 FAIMS Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * Max concurrent PouchDB photo writes. Camera and gallery stay available
 * while below this so more shots can be added during "Saving...".
 */
export const MAX_PARALLEL_SAVES = 5;

/**
 * Flip to `true` to hold each photo on "Saving..." for 10s before the
 * PouchDB write. Device-only testing aid — leave false in commits.
 */
export const DEBUG_SLOW_PHOTOS = false;
const DEBUG_SLOW_PHOTOS_MS = 10_000;

/** Resolves after `DEBUG_SLOW_PHOTOS_MS` when `DEBUG_SLOW_PHOTOS` is on; otherwise no-op. */
export const delayIfSlowPhotosDebug = async (): Promise<void> => {
  if (!DEBUG_SLOW_PHOTOS) return;
  await new Promise<void>(resolve => {
    setTimeout(resolve, DEBUG_SLOW_PHOTOS_MS);
  });
};

/**
 * Limits how many async jobs run at once. `acquire()` grants immediately
 * when a slot is free (the increment happens inside the Promise executor,
 * before the caller `await`s), otherwise the caller waits in FIFO order.
 */
export const createConcurrencyLimiter = (
  limit: number
): {
  readonly active: number;
  acquire(): Promise<void>;
  release(): void;
} => {
  let active = 0;
  const waiters: Array<() => void> = [];

  return {
    get active() {
      return active;
    },
    acquire(): Promise<void> {
      return new Promise<void>(resolve => {
        const grant = () => {
          active += 1;
          resolve();
        };
        if (active < limit) {
          grant();
        } else {
          waiters.push(grant);
        }
      });
    },
    release() {
      active -= 1;
      const next = waiters.shift();
      if (next) next();
    },
  };
};
