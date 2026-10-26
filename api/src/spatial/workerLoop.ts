// SPDX-License-Identifier: Apache-2.0

export type SpatialWorkerLoopOptions = {
  /**
   * Exit after this many milliseconds with no claimed job.
   * `0` never exits (compose / on-prem).
   */
  idleExitMs: number;
  /** Delay between empty polls. Ignored once the idle timeout has elapsed. */
  pollIntervalMs: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** Next unclaimed job id, or undefined when the queue has nothing runnable. */
  findJob: () => Promise<string | undefined>;
  /** Claim and process one job. A lost or deleted claim should resolve, not throw. */
  processJob: (assetId: string) => Promise<void>;
  /**
   * Called when `findJob` throws (missing DB/view, Couch blip). The loop
   * treats that poll as empty and retries. Defaults to `console.error`.
   */
  onPollError?: (error: unknown) => void;
  /**
   * Called when `processJob` throws (deleted layer, failed commit). The
   * loop logs and continues so one bad job does not kill the worker.
   * Defaults to `console.error`.
   */
  onProcessError?: (error: unknown, assetId: string) => void;
  /**
   * Stop after this many polls (empty or not) instead of idling forever.
   * Used by tests when `idleExitMs` is 0.
   */
  maxPolls?: number;
};

/** Resolve after `ms` milliseconds. */
const defaultSleep = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });

const defaultOnPollError = (error: unknown) => {
  console.error('[spatial-worker] poll failed', error);
};

const defaultOnProcessError = (error: unknown, assetId: string) => {
  console.error(`[spatial-worker] process failed ${assetId}`, error);
};

/**
 * Poll, process, repeat. A claim or a finished job resets the idle clock.
 * Time spent inside `processJob` is not idle. A thrown `findJob` is logged
 * and treated as empty so a missing view or Couch blip does not kill the
 * process. A thrown `processJob` is logged the same way so a deleted layer
 * or a failed commit does not exit the worker. Returns `idle` on timeout or
 * `stopped` when `maxPolls` is hit.
 */
export async function runSpatialWorkerLoop(
  options: SpatialWorkerLoopOptions
): Promise<'idle' | 'stopped'> {
  const now = options.now ?? (() => Date.now());
  const sleep = options.sleep ?? defaultSleep;
  const onPollError = options.onPollError ?? defaultOnPollError;
  const onProcessError = options.onProcessError ?? defaultOnProcessError;
  let lastJobFinishedAt = now();
  let polls = 0;

  for (;;) {
    if (options.maxPolls !== undefined && polls >= options.maxPolls) {
      return 'stopped';
    }
    polls += 1;
    let assetId: string | undefined;
    try {
      assetId = await options.findJob();
    } catch (error) {
      onPollError(error);
    }
    if (assetId) {
      // A claim resets the idle window even if processing then loses the claim.
      lastJobFinishedAt = now();
      try {
        await options.processJob(assetId);
      } catch (error) {
        onProcessError(error, assetId);
      }
      lastJobFinishedAt = now();
      continue;
    }
    if (
      options.idleExitMs > 0 &&
      now() - lastJobFinishedAt >= options.idleExitMs
    ) {
      return 'idle';
    }
    await sleep(options.pollIntervalMs);
  }
}
