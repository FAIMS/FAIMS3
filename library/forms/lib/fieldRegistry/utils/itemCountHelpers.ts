// SPDX-License-Identifier: Apache-2.0

/**
 * Gets the effective minimum item count.
 * Required fields need at least one item.
 */
export function getMinimumItemCount({
  required,
  minItems,
}: {
  required?: boolean;
  minItems?: number | null;
}): number {
  return Math.max(required ? 1 : 0, minItems ?? 0);
}

/**
 * Calculate remaining item capacity.
 * Returns null when no maximum is configured.
 */
export function getRemainingItemCount({
  maxItems,
  currentCount,
}: {
  maxItems: number | null | undefined;
  currentCount: number;
}): number | null {
  return maxItems == null ? null : Math.max(0, maxItems - currentCount);
}
