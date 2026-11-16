// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {createAsyncMutex, createAsyncSemaphore} from './asyncMutex';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('createAsyncMutex', () => {
  it('runs jobs one at a time', async () => {
    const runExclusive = createAsyncMutex();
    let current = 0;
    let max = 0;
    await Promise.all(
      [1, 2, 3, 4].map(() =>
        runExclusive(async () => {
          current += 1;
          max = Math.max(max, current);
          await delay(5);
          current -= 1;
        })
      )
    );
    expect(max).toBe(1);
  });
});

describe('createAsyncSemaphore', () => {
  it('caps concurrent jobs', async () => {
    const runLimited = createAsyncSemaphore(2);
    let current = 0;
    let max = 0;
    await Promise.all(
      [1, 2, 3, 4, 5].map(() =>
        runLimited(async () => {
          current += 1;
          max = Math.max(max, current);
          await delay(10);
          current -= 1;
        })
      )
    );
    expect(max).toBe(2);
  });

  it('releases a slot when a job rejects', async () => {
    const runLimited = createAsyncSemaphore(1);
    await expect(
      runLimited(async () => Promise.reject(new Error('boom')))
    ).rejects.toThrow('boom');
    await expect(runLimited(async () => 'ok')).resolves.toBe('ok');
  });
});
