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

/**
 * Builds a hint for configured item count requirements.
 *
 * Required fields need at least one item.
 * Null or undefined limits mean no additional restriction.
 *
 * Returns null when there are no count requirements to display.
 */
type GetItemCountHintInput = {
  /** Whether at least one item is required. */
  required?: boolean;
  /** Minimum number of items allowed. */
  minItems?: number | null;
  /** Maximum number of items allowed. */
  maxItems?: number | null;
  /** Singular item name, e.g. 'photo' or 'attachment'. */
  itemName: string;
};
export function getItemCountHint({
  required,
  minItems,
  maxItems,
  itemName,
}: GetItemCountHintInput): string | null {
  const min = getMinimumItemCount({required, minItems});

  // Pluralise the item name based on the count.
  const item = (count: number) => `${itemName}${count === 1 ? '' : 's'}`;

  // Both minimum and maximum are configured.
  if (min > 0 && maxItems != null) {
    if (min === maxItems) {
      return `Add exactly ${min} ${item(min)}.`;
    }

    return `Add between ${min} and ${maxItems} ${item(maxItems)}.`;
  }

  // Minimum only.
  if (min > 0) {
    return `Add at least ${min} ${item(min)}.`;
  }

  // Maximum only.
  if (maxItems != null) {
    return `Add up to ${maxItems} ${item(maxItems)}.`;
  }

  return null;
}
