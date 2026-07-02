/**
 * @file Type definitions for scoped field search in pickers and condition editors.
 */

import type {FieldType} from '../../state/initial';

/** Decreasing search priority: label → id → helper text → advanced helper text. */
export const FIELD_SEARCH_KEY_WEIGHTS = [4, 3, 2, 1] as const;

export type FieldSearchScope =
  | {kind: 'all'}
  | {kind: 'viewset'; viewsetId: string}
  | {
      kind: 'context';
      /** Field whose condition is being edited; scopes to its form and excludes itself. */
      fieldId?: string;
      /** Section whose condition is being edited; scopes to its form and excludes its fields. */
      sectionId?: string;
    };

export type FieldSearchFilters = {
  /** Field ids to omit from results. */
  excludeFieldIds?: string[];
  /** All fields in a section to omit (e.g. current section for section conditions). */
  excludeSectionFieldIds?: string[];
  /** Only include fields with these component names. */
  componentNames?: string[];
  /** Exclude fields with these component names. */
  excludeComponentNames?: string[];
  /** Only include fields with this return type (e.g. `faims-core::String`). */
  typeReturned?: string;
  /** When set, only include/exclude required fields. */
  required?: boolean;
  /** Additional predicate applied after built-in filters. */
  predicate?: (fieldId: string, field: FieldType) => boolean;
};

/** Searchable snapshot of one field, aligned with {@link LABEL_ID_HELPER_ADVANCED_WEIGHTS} keys. */
export type FieldSearchEntry = {
  fieldId: string;
  field: FieldType;
  label: string;
  id: string;
  helperText: string;
  advancedHelperText: string;
  viewSetLabel: string;
  sectionLabel: string;
};

export type FieldSearchResult = {
  fieldId: string;
  field: FieldType;
  label: string;
  helperText: string;
  viewSetLabel: string;
  sectionLabel: string;
  score: number;
  /** Present when a non-empty query produced a fuzzysort match. */
  fuzzysort?: Fuzzysort.KeysResult<FieldSearchEntry>;
};

export type UseFieldSearchOptions = {
  scope: FieldSearchScope;
  filters?: FieldSearchFilters;
  /** Max results returned (default 50). */
  limit?: number;
  /** Debounce delay before running fuzzy search (default 200ms). */
  debounceMs?: number;
};
