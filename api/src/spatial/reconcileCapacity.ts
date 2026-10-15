// SPDX-License-Identifier: Apache-2.0
import type {ICapacityProvider} from '../services/capacityProvider';

export type SpatialBacklog = {
  /** Processing jobs with originals and a fresh claim. */
  inFlight: number;
  /** Processing jobs with originals and no fresh claim. */
  unclaimed: number;
};

/**
 * How many workers the queue needs right now.
 * Zero when nothing is in flight or waiting. Never exceeds `max`.
 */
export function capacityNeeded({
  inFlight,
  unclaimed,
  max,
}: SpatialBacklog & {max: number}): number {
  const waiting = Math.max(0, inFlight) + Math.max(0, unclaimed);
  if (waiting === 0 || max <= 0) {
    return 0;
  }
  return Math.min(max, waiting);
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
}: SpatialBacklog & {
  provider: ICapacityProvider;
  max: number;
}): Promise<ReconcileCapacityResult> {
  const needed = capacityNeeded({inFlight, unclaimed, max});
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
