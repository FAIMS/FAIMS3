/**
 * @file React hook for debounced global design search (forms, sections, fields).
 */

import {useEffect, useMemo, useState} from 'react';
import {
  LABEL_ID_HELPER_ADVANCED_WEIGHTS,
  weightedFuzzySearch,
} from '../search/weightedFuzzySearch';
import {
  selectUiFields,
  selectUiViews,
  selectUiViewSets,
} from '../../store/selectors';
import {useAppSelector} from '../../state/hooks';
import {
  buildDesignSearchEntries,
  type DesignSearchEntry,
  type DesignSearchResult,
  type UseDesignSearchOptions,
} from './designSearchUtils';

const DEFAULT_DEBOUNCE_MS = 200;
const SEARCH_KEYS = [
  'label',
  'id',
  'helperText',
  'advancedHelperText',
] as const satisfies ReadonlyArray<keyof DesignSearchEntry>;

export type UseDesignSearchReturn = {
  /** Current input text (updates immediately as the user types). */
  query: string;
  setQuery: (query: string) => void;
  /** Debounced query used for fuzzy search and match highlighting. */
  searchQuery: string;
  results: DesignSearchResult[];
  /** Total indexed entries (forms + sections + fields). */
  candidateCount: number;
};

/** Global fuzzy search across forms, sections, and fields in the current design. */
export const useDesignSearch = (
  options: UseDesignSearchOptions = {}
): UseDesignSearchReturn => {
  const {limit = 50, debounceMs = DEFAULT_DEBOUNCE_MS} = options;
  const [query, setQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fields = useAppSelector(selectUiFields);
  const views = useAppSelector(selectUiViews);
  const viewsets = useAppSelector(selectUiViewSets);

  useEffect(() => {
    if (query.trim() === '') {
      setSearchQuery('');
      return;
    }

    const timer = window.setTimeout(() => setSearchQuery(query), debounceMs);
    return () => window.clearTimeout(timer);
  }, [query, debounceMs]);

  const entries = useMemo(
    () => buildDesignSearchEntries(viewsets, views, fields),
    [viewsets, views, fields]
  );

  const results = useMemo((): DesignSearchResult[] => {
    const matches = weightedFuzzySearch(entries, searchQuery, SEARCH_KEYS, {
      weights: LABEL_ID_HELPER_ADVANCED_WEIGHTS,
      limit,
      sortEmptyQuery: (a, b) => {
        const typeOrder =
          designTypeSortRank(a.type) - designTypeSortRank(b.type);
        if (typeOrder !== 0) return typeOrder;
        return a.label.localeCompare(b.label, undefined, {
          sensitivity: 'base',
        });
      },
    });

    return matches.map(({obj, score, fuzzysort}) => ({
      ...obj,
      score,
      fuzzysort,
    }));
  }, [entries, searchQuery, limit]);

  return {
    query,
    setQuery,
    searchQuery,
    results,
    candidateCount: entries.length,
  };
};

/** Forms first, then sections, then fields — stable browse order when query is empty. */
const designTypeSortRank = (type: DesignSearchEntry['type']): number => {
  switch (type) {
    case 'form':
      return 0;
    case 'section':
      return 1;
    case 'field':
      return 2;
  }
};
