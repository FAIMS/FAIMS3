import {
  NOTEBOOK_NAME_PLURAL,
  NOTEBOOK_NAME_PLURAL_CAPITALIZED,
} from '@/constants';

/**
 * URL/search keys and values for /archive — keep in sync with sidebar + route validateSearch.
 * The first tab is the plural of `VITE_NOTEBOOK_NAME` (e.g. notebooks, surveys).
 * Teams are omitted until team archive is implemented.
 *
 * Template archive row actions (restore, delete) and copy for delete confirmations:
 * see `archived-templates.tsx` and `template-delete-warnings.ts` in this folder.
 */
export const ARCHIVE_TAB_VALUES = [
  NOTEBOOK_NAME_PLURAL,
  'templates',
  'users',
] as const;

export type ArchiveTab = (typeof ARCHIVE_TAB_VALUES)[number];

export const DEFAULT_ARCHIVE_TAB: ArchiveTab =
  NOTEBOOK_NAME_PLURAL as ArchiveTab;

export const ARCHIVE_TAB_LABELS: Record<ArchiveTab, string> = {
  [NOTEBOOK_NAME_PLURAL as ArchiveTab]: NOTEBOOK_NAME_PLURAL_CAPITALIZED,
  templates: 'Templates',
  users: 'Users',
};

/** Tabs shown in sidebar and /archive for the current permissions. */
export function getVisibleArchiveTabs(flags: {
  canSeeProjects: boolean;
  canSeeTemplates: boolean;
  canSeeUsers: boolean;
}): ArchiveTab[] {
  const tabs: ArchiveTab[] = [];
  if (flags.canSeeProjects) tabs.push(NOTEBOOK_NAME_PLURAL as ArchiveTab);
  if (flags.canSeeTemplates) tabs.push('templates');
  if (flags.canSeeUsers) tabs.push('users');
  return tabs;
}

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
