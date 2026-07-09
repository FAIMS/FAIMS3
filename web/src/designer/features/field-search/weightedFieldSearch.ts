/**
 * @file Field-specific wrapper around {@link weightedFuzzySearch}.
 */

import {
  LABEL_ID_HELPER_ADVANCED_WEIGHTS,
  weightedFuzzySearch as weightedFuzzySearchGeneric,
} from '../search/weightedFuzzySearch';
import type {FieldSearchEntry, FieldSearchResult} from './types';

export {computeWeightedScore} from '../search/weightedFuzzySearch';
export {FIELD_SEARCH_KEY_WEIGHTS} from './types';

const SEARCH_KEYS = [
  'label',
  'id',
  'helperText',
  'advancedHelperText',
] as const satisfies ReadonlyArray<keyof FieldSearchEntry>;

/**
 * Fuzzy search over field entries with decreasing priority:
 * label → field id → helper text → advanced helper text.
 */
export const weightedFieldSearch = (
  entries: FieldSearchEntry[],
  query: string,
  limit = 50
): FieldSearchResult[] => {
  const matches = weightedFuzzySearchGeneric(entries, query, SEARCH_KEYS, {
    weights: LABEL_ID_HELPER_ADVANCED_WEIGHTS,
    limit,
    sortEmptyQuery: (a, b) =>
      a.label.localeCompare(b.label, undefined, {sensitivity: 'base'}),
  });

  return matches.map(({obj, score, fuzzysort}) => ({
    fieldId: obj.fieldId,
    field: obj.field,
    label: obj.label,
    helperText: obj.helperText,
    viewSetLabel: obj.viewSetLabel,
    sectionLabel: obj.sectionLabel,
    score,
    fuzzysort,
  }));
};
