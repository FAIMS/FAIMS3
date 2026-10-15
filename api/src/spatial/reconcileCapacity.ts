// SPDX-License-Identifier: Apache-2.0
import type {ICapacityProvider} from '../services/capacityProvider';

export type SpatialBacklog = {
  /** `processing` jobs with originals and a fresh worker claim. */
  inFlight: number;
  /** `pending` jobs (or stale `processing`) with originals and no live claim. */
  unclaimed: number;
};

/**
 * Queue depths at which worker count increases from 1.
 * `3,8,16,32` means 1→2 at 3 jobs, 2→3 at 8, 3→4 at 16, 4→5 at 32.
 */
export const DEFAULT_CAPACITY_SCALE_THRESHOLDS_CSV = '3,8,16,32';

/** Parsed form of {@link DEFAULT_CAPACITY_SCALE_THRESHOLDS_CSV}. */
export const DEFAULT_CAPACITY_SCALE_THRESHOLDS = [3, 8, 16, 32] as const;

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
 * Parse `3,8,16,32` into strictly increasing positive integers.
 * @throws Error when a token is missing, not a positive integer, or not increasing.
 */
export function parseCapacityScaleThresholds(csv: string): number[] {
  const values = csv
    .split(',')
    .map(part => part.trim())
    .filter(part => part.length > 0)
    .map(part => {
      if (!/^[0-9]+$/.test(part)) {
        throw new Error(
          `CAPACITY_SCALE_THRESHOLDS must be a CSV of positive integers, got "${csv}"`
        );
      }
      return Number(part);
    });
  if (values.some(value => !Number.isInteger(value) || value < 1)) {
    throw new Error(
      `CAPACITY_SCALE_THRESHOLDS must be a CSV of positive integers, got "${csv}"`
    );
  }
  for (let i = 1; i < values.length; i++) {
    if (values[i] <= values[i - 1]) {
      throw new Error(
        `CAPACITY_SCALE_THRESHOLDS must be strictly increasing, got "${csv}"`
      );
    }
  }
  return values;
}

/**
 * How many workers the queue needs right now.
 * Zero when nothing is in flight or waiting. Walks the scale map, then
 * never exceeds `max`.
 */
export function capacityNeeded({
  inFlight,
  unclaimed,
  max,
  scaleThresholds,
}: SpatialBacklog & {
  max: number;
  scaleThresholds: readonly number[];
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
  return Math.min(max, needed);
}

export type ReconcileCapacityResult = {
  needed: number;
  /** True when ensureCapacity was called. Never true for a scale-down. */
  ensured: boolean;
};

/**
 * Start workers when the backlog is deeper than running + pending capacity.
 * When `needed` is 0 this does nothing — idle workers exit on their own.
 */
export async function reconcileCapacity({
  provider,
  inFlight,
  unclaimed,
  max,
  scaleThresholds,
}: SpatialBacklog & {
  provider: ICapacityProvider;
  max: number;
  scaleThresholds: readonly number[];
}): Promise<ReconcileCapacityResult> {
  const needed = capacityNeeded({inFlight, unclaimed, max, scaleThresholds});
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
