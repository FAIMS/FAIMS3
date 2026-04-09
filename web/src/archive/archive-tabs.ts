import {NOTEBOOK_NAME_PLURAL} from '@/constants';

/**
 * URL/search keys and values for /archive — keep in sync with sidebar + route validateSearch.
 * The first tab is the plural of `VITE_NOTEBOOK_NAME` (e.g. notebooks, surveys).
 *
 * Template archive row actions (restore, delete) and copy for delete confirmations:
 * see `archived-templates.tsx` and `template-delete-warnings.ts` in this folder.
 */
export const ARCHIVE_TAB_VALUES = [
  NOTEBOOK_NAME_PLURAL,
  'templates',
  'users',
  'teams',
] as const;

export type ArchiveTab = (typeof ARCHIVE_TAB_VALUES)[number];

export const DEFAULT_ARCHIVE_TAB: ArchiveTab =
  NOTEBOOK_NAME_PLURAL as ArchiveTab;

export function parseArchiveTab(search: Record<string, unknown>): ArchiveTab {
  const tab = search.tab;
  if (
    typeof tab === 'string' &&
    ARCHIVE_TAB_VALUES.includes(tab as ArchiveTab)
  ) {
    return tab as ArchiveTab;
  }
  return DEFAULT_ARCHIVE_TAB;
}
