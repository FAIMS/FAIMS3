/**
 * @file React hook for debounced, scoped field search backed by the designer store.
 */

import {useEffect, useMemo, useState} from 'react';
import {
  selectUiFields,
  selectUiViews,
  selectUiViewSets,
} from '../../store/selectors';
import {useAppSelector} from '../../state/hooks';
import {
  applyFieldFilters,
  buildFieldSearchEntries,
  resolveFieldIdsInScope,
} from './fieldSearchUtils';
import type {FieldSearchResult, UseFieldSearchOptions} from './types';
import {weightedFieldSearch} from './weightedFieldSearch';

const DEFAULT_DEBOUNCE_MS = 200;

export type UseFieldSearchReturn = {
  /** Current input text (updates immediately as the user types). */
  query: string;
  setQuery: (query: string) => void;
  /** Debounced query used for fuzzy search and match highlighting. */
  searchQuery: string;
  results: FieldSearchResult[];
  /** Total candidates after scope + filters, before search ranking. */
  candidateCount: number;
};

/**
 * Search fields in the current design with weighted fuzzy matching and filters.
 * Reads field/view/viewset data from the designer store unless overridden.
 */
export const useFieldSearch = (
  options: UseFieldSearchOptions
): UseFieldSearchReturn => {
  const {
    scope,
    filters,
    limit = 50,
    debounceMs = DEFAULT_DEBOUNCE_MS,
  } = options;
  const [query, setQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const allFields = useAppSelector(selectUiFields);
  const views = useAppSelector(selectUiViews);
  const viewsets = useAppSelector(selectUiViewSets);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed === '') {
      setSearchQuery('');
      return;
    }

    const timer = window.setTimeout(() => setSearchQuery(query), debounceMs);
    return () => window.clearTimeout(timer);
  }, [query, debounceMs]);

  const candidateIds = useMemo(
    () =>
      applyFieldFilters(
        resolveFieldIdsInScope(allFields, views, viewsets, scope),
        allFields,
        filters
      ),
    [allFields, views, viewsets, scope, filters]
  );

  const entries = useMemo(
    () => buildFieldSearchEntries(candidateIds, allFields, views, viewsets),
    [candidateIds, allFields, views, viewsets]
  );

  const results = useMemo(
    () => weightedFieldSearch(entries, searchQuery, limit),
    [entries, searchQuery, limit]
  );

  return {
    query,
    setQuery,
    searchQuery,
    results,
    candidateCount: candidateIds.length,
  };
};
