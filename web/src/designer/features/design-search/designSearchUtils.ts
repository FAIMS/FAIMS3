/**
 * @file Flattens forms, sections, and fields into a single searchable index.
 */

import {buildFieldSearchEntry} from '../field-search/fieldSearchUtils';
import type {FieldType} from '../../state/initial';

export type DesignSearchResultType = 'form' | 'section' | 'field';

/** One row in the global design search index (before ranking). */
export type DesignSearchEntry = {
  /** Stable unique key for React lists and selection. */
  resultId: string;
  type: DesignSearchResultType;
  label: string;
  id: string;
  helperText: string;
  advancedHelperText: string;
  viewSetId: string;
  viewSetLabel: string;
  sectionId?: string;
  sectionLabel?: string;
  fieldId?: string;
};

export type DesignSearchResult = DesignSearchEntry & {
  score: number;
  fuzzysort?: Fuzzysort.KeysResult<DesignSearchEntry>;
};

export type UseDesignSearchOptions = {
  limit?: number;
  debounceMs?: number;
};

type ViewMap = Record<
  string,
  {label: string; fields: string[]; description?: string}
>;
type ViewSetMap = Record<string, {label: string; views: string[]}>;

/**
 * Walks viewsets → sections → fields and builds flat search entries.
 * Section `helperText` stores the parent form label so form name matches rank highly.
 */
export const buildDesignSearchEntries = (
  viewsets: ViewSetMap,
  views: ViewMap,
  fields: Record<string, FieldType>
): DesignSearchEntry[] => {
  const entries: DesignSearchEntry[] = [];

  for (const [viewSetId, viewset] of Object.entries(viewsets)) {
    const sectionCount = viewset.views.length;
    entries.push({
      resultId: `form:${viewSetId}`,
      type: 'form',
      label: viewset.label,
      id: viewSetId,
      helperText: sectionCount === 1 ? '1 section' : `${sectionCount} sections`,
      advancedHelperText: '',
      viewSetId,
      viewSetLabel: viewset.label,
    });

    for (const sectionId of viewset.views) {
      const section = views[sectionId];
      if (!section) continue;

      entries.push({
        resultId: `section:${sectionId}`,
        type: 'section',
        label: section.label,
        id: sectionId,
        helperText: viewset.label,
        advancedHelperText: String(section.description ?? ''),
        viewSetId,
        viewSetLabel: viewset.label,
        sectionId,
        sectionLabel: section.label,
      });

      for (const fieldId of section.fields) {
        const field = fields[fieldId];
        if (!field) continue;

        const fieldEntry = buildFieldSearchEntry(fieldId, field);
        entries.push({
          resultId: `field:${fieldId}`,
          type: 'field',
          label: fieldEntry.label,
          id: fieldId,
          helperText: fieldEntry.helperText,
          advancedHelperText: fieldEntry.advancedHelperText,
          viewSetId,
          viewSetLabel: viewset.label,
          sectionId,
          sectionLabel: section.label,
          fieldId,
        });
      }
    }
  }

  return entries;
};

/** Human-readable type badge labels for search result rows. */
export const designSearchTypeLabel: Record<DesignSearchResultType, string> = {
  form: 'Form',
  section: 'Section',
  field: 'Field',
};
