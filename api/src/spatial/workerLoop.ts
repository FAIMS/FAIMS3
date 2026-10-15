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
  /** Claim and process one job. A lost claim should resolve, not throw. */
  processJob: (assetId: string) => Promise<void>;
  /**
   * Stop after this many polls (empty or not) instead of idling forever.
   * Used by tests when `idleExitMs` is 0.
   */
  maxPolls?: number;
};

const defaultSleep = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });

/**
 * Poll, process, repeat. A claim or a finished job resets the idle clock.
 * Time spent inside `processJob` is not idle. Returns `idle` on timeout
 * or `stopped` when `maxPolls` is hit.
 */
export async function runSpatialWorkerLoop(
  options: SpatialWorkerLoopOptions
): Promise<'idle' | 'stopped'> {
  const now = options.now ?? (() => Date.now());
  const sleep = options.sleep ?? defaultSleep;
  let lastJobFinishedAt = now();
  let polls = 0;

  for (;;) {
    if (options.maxPolls !== undefined && polls >= options.maxPolls) {
      return 'stopped';
    }
    polls += 1;
    const assetId = await options.findJob();
    if (assetId) {
      // A claim resets the idle window even if processing then loses the claim.
      lastJobFinishedAt = now();
      await options.processJob(assetId);
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
