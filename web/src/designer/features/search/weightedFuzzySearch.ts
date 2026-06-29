/**
 * @file Shared weighted fuzzy search used by field picker and global design search.
 */

import fuzzysort from 'fuzzysort';

/** Default decreasing priority: primary label → id → helper text → advanced helper text. */
export const LABEL_ID_HELPER_ADVANCED_WEIGHTS = [4, 3, 2, 1] as const;

/**
 * Combines per-key fuzzysort scores into one rank.
 * Each key's score is scaled by its weight; the highest weighted contribution wins.
 */
export const computeWeightedScore = (
  keyResults: ReadonlyArray<{score: number} | null | undefined>,
  weights: readonly number[] = LABEL_ID_HELPER_ADVANCED_WEIGHTS
): number => {
  const maxWeight = Math.max(...weights);
  let best = 0;
  for (let i = 0; i < weights.length; i++) {
    const result = keyResults[i];
    if (result && result.score > 0) {
      best = Math.max(best, (result.score * weights[i]) / maxWeight);
    }
  }
  return best;
};

/** One ranked search hit with optional raw fuzzysort metadata for highlighting. */
export type WeightedFuzzyMatch<T> = {
  obj: T;
  score: number;
  fuzzysort?: Fuzzysort.KeysResult<T>;
};

/**
 * Generic weighted fuzzy search over string properties of each entry.
 *
 * When `query` is empty, returns entries in `sortEmptyQuery` order (or insertion
 * order) with a neutral score of 1 — callers use this for browse mode.
 */
export const weightedFuzzySearch = <T extends object>(
  entries: T[],
  query: string,
  keys: ReadonlyArray<keyof T & string>,
  options?: {
    /** Parallel to `keys`; higher weight ranks matches on that property first. */
    weights?: readonly number[];
    limit?: number;
    /** Minimum fuzzysort score (0–1) to include a match. */
    threshold?: number;
    /** Sort applied when the query is empty (browse / no-filter mode). */
    sortEmptyQuery?: (a: T, b: T) => number;
  }
): WeightedFuzzyMatch<T>[] => {
  const {
    weights = LABEL_ID_HELPER_ADVANCED_WEIGHTS,
    limit = 50,
    threshold = 0.15,
    sortEmptyQuery,
  } = options ?? {};

  const trimmed = query.trim();
  if (!trimmed) {
    const sorted = sortEmptyQuery
      ? [...entries].sort(sortEmptyQuery)
      : [...entries];
    return sorted.slice(0, limit).map(obj => ({obj, score: 1}));
  }

  const matches = fuzzysort.go(trimmed, entries, {
    keys: [...keys],
    limit,
    threshold,
    scoreFn: result =>
      computeWeightedScore(
        keys.map((_, index) => result[index] ?? null),
        weights
      ),
  });

  return matches.map(match => ({
    obj: match.obj,
    score: match.score,
    fuzzysort: match,
  }));
};
