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

import {describe, expect, it} from 'vitest';
import {
  createConcurrencyLimiter,
  DEBUG_SLOW_PHOTOS,
  delayIfSlowPhotosDebug,
  MAX_PARALLEL_SAVES,
} from './parallelSaveLimiter';

describe('createConcurrencyLimiter', () => {
  it('exposes a module const of 5 parallel photo saves', () => {
    expect(MAX_PARALLEL_SAVES).toBe(5);
  });

  it('grants immediately while under the limit and increments before await', async () => {
    const limiter = createConcurrencyLimiter(2);
    const first = limiter.acquire();
    expect(limiter.active).toBe(1);
    const second = limiter.acquire();
    expect(limiter.active).toBe(2);
    await Promise.all([first, second]);
    expect(limiter.active).toBe(2);
  });

  it('queues callers past the limit and releases in FIFO order', async () => {
    const limiter = createConcurrencyLimiter(2);
    await limiter.acquire();
    await limiter.acquire();

    let thirdGranted = false;
    const third = limiter.acquire().then(() => {
      thirdGranted = true;
    });
    expect(limiter.active).toBe(2);
    expect(thirdGranted).toBe(false);

    limiter.release();
    await third;
    expect(thirdGranted).toBe(true);
    expect(limiter.active).toBe(2);

    limiter.release();
    limiter.release();
    expect(limiter.active).toBe(0);
  });

  it('never runs more than the limit concurrently', async () => {
    const limiter = createConcurrencyLimiter(MAX_PARALLEL_SAVES);
    let running = 0;
    let maxRunning = 0;

    const jobs = Array.from({length: 12}, async () => {
      await limiter.acquire();
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      await Promise.resolve();
      running -= 1;
      limiter.release();
    });

    await Promise.all(jobs);
    expect(maxRunning).toBe(MAX_PARALLEL_SAVES);
    expect(limiter.active).toBe(0);
  });
});

describe('DEBUG_SLOW_PHOTOS', () => {
  it('is off by default so device builds are not delayed', () => {
    expect(DEBUG_SLOW_PHOTOS).toBe(false);
  });

  it('resolves immediately when the debug flag is off', async () => {
    const started = Date.now();
    await delayIfSlowPhotosDebug();
    expect(Date.now() - started).toBeLessThan(50);
  });
});
