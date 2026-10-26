// SPDX-License-Identifier: Apache-2.0
/**
 * Background API poll that fails original uploads abandoned after the
 * HTTP 201 (nodemon reload, deploy, crash). The worker never claims a
 * job with no stored originals, so these would otherwise stay
 * "uploading" until deleted.
 */

import {config} from '../../buildconfig';
import {MAP_ASSET_PROCESSING_LOG} from '../../logging';
import {failStaleOriginalStores} from './store';

/** How often the API process looks for abandoned original uploads. */
export const MAP_ASSET_ORIGINAL_STORE_SWEEP_INTERVAL_MS = 60 * 1000;

export type OriginalStoreSweepLoopOptions = {
  /** Delay after each sweep. Defaults to the module interval const. */
  intervalMs?: number;
  sweep?: () => Promise<unknown>;
  sleep?: (ms: number) => Promise<void>;
  onPollError?: (error: unknown) => void;
  /**
   * Stop after this many polls instead of running forever.
   * Used by tests.
   */
  maxPolls?: number;
};

/** Resolve after `ms` milliseconds. */
const defaultSleep = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });

const defaultOnPollError = (error: unknown) => {
  console.error(
    `${MAP_ASSET_PROCESSING_LOG} original-store sweep failed`,
    error
  );
};

/**
 * Sweep, sleep, repeat. A thrown sweep is logged and treated as empty so
 * a Couch blip does not kill the API process. Returns `stopped` when
 * `maxPolls` is hit. Production callers omit `maxPolls` and run forever.
 */
export async function runOriginalStoreSweepLoop(
  options: OriginalStoreSweepLoopOptions = {}
): Promise<'stopped'> {
  const intervalMs =
    options.intervalMs ?? MAP_ASSET_ORIGINAL_STORE_SWEEP_INTERVAL_MS;
  const sweep = options.sweep ?? failStaleOriginalStores;
  const sleep = options.sleep ?? defaultSleep;
  const onPollError = options.onPollError ?? defaultOnPollError;
  let polls = 0;

  for (;;) {
    if (options.maxPolls !== undefined && polls >= options.maxPolls) {
      return 'stopped';
    }
    polls += 1;
    try {
      await sweep();
    } catch (error) {
      onPollError(error);
    }
    if (options.maxPolls !== undefined && polls >= options.maxPolls) {
      return 'stopped';
    }
    await sleep(intervalMs);
  }
}

let running: Promise<'stopped'> | undefined;

/**
 * Start the process-wide original-upload sweep. Idempotent. No-op under
 * test (tests call {@link runOriginalStoreSweepLoop} directly).
 */
export function startOriginalStoreSweep(): void {
  if (config.runningUnderTest || running) {
    return;
  }
  running = runOriginalStoreSweepLoop().finally(() => {
    running = undefined;
  });
  running.catch(error => {
    console.error(
      `${MAP_ASSET_PROCESSING_LOG} original-store sweep loop exited`,
      error
    );
  });
}

/** Stop handle for tests. The production loop has no idle exit. */
export function isOriginalStoreSweepRunning(): boolean {
  return running !== undefined;
}
