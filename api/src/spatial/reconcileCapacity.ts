// SPDX-License-Identifier: Apache-2.0
import {
  DEFAULT_CAPACITY_SCALE_IN_COOLDOWN_FACTOR,
  DEFAULT_CAPACITY_SCALE_IN_COOLDOWN_MS,
  DEFAULT_CAPACITY_SCALE_THRESHOLDS,
  DEFAULT_CAPACITY_SCALE_THRESHOLDS_CSV,
  DEFAULT_CAPACITY_STARVATION_MS,
  defaultScaleInCooldownMs,
  parseCapacityScaleThresholds,
} from '@faims3/build-config';
import type {ICapacityProvider} from '../services/capacityProvider';

export {
  DEFAULT_CAPACITY_SCALE_IN_COOLDOWN_FACTOR,
  DEFAULT_CAPACITY_SCALE_IN_COOLDOWN_MS,
  DEFAULT_CAPACITY_SCALE_THRESHOLDS,
  DEFAULT_CAPACITY_SCALE_THRESHOLDS_CSV,
  DEFAULT_CAPACITY_STARVATION_MS,
  defaultScaleInCooldownMs,
  parseCapacityScaleThresholds,
};

export type SpatialBacklog = {
  /** `processing` jobs with originals and a fresh worker claim. */
  inFlight: number;
  /** `pending` jobs (or stale `processing`) with originals and no live claim. */
  unclaimed: number;
  /**
   * Age in ms of the oldest unclaimed job (`updatedAt` of the last
   * document change, else `createdAt`). Absent when nothing is waiting
   * for a worker.
   */
  oldestUnclaimedMs?: number;
};

/** Lowest queue depth that unlocks this many workers. */
export type CapacityScaleStep = {
  depth: number;
  workers: number;
};

/**
 * Builds the queue-depth → worker-count steps from scale-up tips.
 * Any positive depth starts at 1 worker until the first tip.
 */
export function capacityScaleMap(
  thresholds: readonly number[]
): CapacityScaleStep[] {
  const steps: CapacityScaleStep[] = [{depth: 1, workers: 1}];
  for (let i = 0; i < thresholds.length; i++) {
    steps.push({depth: thresholds[i], workers: i + 2});
  }
  return steps;
}

/**
 * True when the oldest unclaimed job has waited at least `starvationMs`.
 * `starvationMs <= 0` turns the trigger off.
 */
export function backlogIsStarved({
  unclaimed,
  oldestUnclaimedMs,
  starvationMs,
}: Pick<SpatialBacklog, 'unclaimed' | 'oldestUnclaimedMs'> & {
  starvationMs: number;
}): boolean {
  return (
    starvationMs > 0 &&
    unclaimed > 0 &&
    oldestUnclaimedMs !== undefined &&
    oldestUnclaimedMs >= starvationMs
  );
}

/**
 * Extra workers from the oldest unclaimed job's age.
 * The first extra is at `starvationMs`; each further extra waits
 * `scaleInCooldownMs`. `starvationMs <= 0` disables. `scaleInCooldownMs <= 0`
 * keeps only that first extra.
 */
export function staleCapacityBonus({
  unclaimed,
  oldestUnclaimedMs,
  starvationMs,
  scaleInCooldownMs,
}: Pick<SpatialBacklog, 'unclaimed' | 'oldestUnclaimedMs'> & {
  starvationMs: number;
  scaleInCooldownMs: number;
}): number {
  const age = oldestUnclaimedMs;
  if (
    age === undefined ||
    !backlogIsStarved({unclaimed, oldestUnclaimedMs: age, starvationMs})
  ) {
    return 0;
  }
  if (scaleInCooldownMs <= 0) {
    return 1;
  }
  return 1 + Math.floor((age - starvationMs) / scaleInCooldownMs);
}

/**
 * How many workers the queue needs right now.
 * Zero when nothing is in flight or waiting. Walks the scale map, then
 * never exceeds `max` or the job count (`inFlight` + `unclaimed`). A
 * starved unclaimed job adds extra workers above the depth step (first
 * at `starvationMs`, then one per cooldown), still inside those caps.
 */
export function capacityNeeded({
  inFlight,
  unclaimed,
  oldestUnclaimedMs,
  max,
  scaleThresholds,
  starvationMs = DEFAULT_CAPACITY_STARVATION_MS,
  scaleInCooldownMs,
}: SpatialBacklog & {
  max: number;
  scaleThresholds: readonly number[];
  starvationMs?: number;
  scaleInCooldownMs?: number;
}): number {
  const waiting = Math.max(0, inFlight) + Math.max(0, unclaimed);
  if (waiting === 0 || max <= 0) {
    return 0;
  }
  let needed = 1;
  for (const step of capacityScaleMap(scaleThresholds)) {
    if (waiting >= step.depth) {
      needed = step.workers;
    }
  }
  const cooldown = scaleInCooldownMs ?? defaultScaleInCooldownMs(starvationMs);
  needed += staleCapacityBonus({
    unclaimed,
    oldestUnclaimedMs,
    starvationMs,
    scaleInCooldownMs: cooldown,
  });
  return Math.min(max, waiting, needed);
}

export type ReconcileCapacityResult = {
  needed: number;
  /** True when ensureCapacity was called. Never true for a scale-down. */
  ensured: boolean;
};

/**
 * Start workers when the backlog is deeper than running + pending capacity,
 * or when the oldest unclaimed job has passed the starvation timeout
 * (and later cooldown steps). Never asks for more workers than jobs.
 * When `needed` is 0 this does nothing — idle workers exit on their own.
 */
export async function reconcileCapacity({
  provider,
  inFlight,
  unclaimed,
  oldestUnclaimedMs,
  max,
  scaleThresholds,
  starvationMs = DEFAULT_CAPACITY_STARVATION_MS,
  scaleInCooldownMs,
}: SpatialBacklog & {
  provider: ICapacityProvider;
  max: number;
  scaleThresholds: readonly number[];
  starvationMs?: number;
  scaleInCooldownMs?: number;
}): Promise<ReconcileCapacityResult> {
  const needed = capacityNeeded({
    inFlight,
    unclaimed,
    oldestUnclaimedMs,
    max,
    scaleThresholds,
    starvationMs,
    scaleInCooldownMs,
  });
  if (needed === 0) {
    return {needed, ensured: false};
  }
  const snapshot = await provider.getCapacity();
  if (snapshot.running + snapshot.pending >= needed) {
    return {needed, ensured: false};
  }
  await provider.ensureCapacity(needed);
  return {needed, ensured: true};
}
