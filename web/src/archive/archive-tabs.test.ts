// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {config} from '@/constants';
import {
  ARCHIVE_TAB_VALUES,
  DEFAULT_ARCHIVE_TAB,
  getVisibleArchiveTabs,
  parseArchiveTab,
} from './archive-tabs';

describe('archive tabs', () => {
  it('includes teams in ARCHIVE_TAB_VALUES', () => {
    expect(ARCHIVE_TAB_VALUES).toContain('teams');
  });

  it('getVisibleArchiveTabs includes teams when the caller can see teams', () => {
    expect(
      getVisibleArchiveTabs({
        canSeeProjects: false,
        canSeeTemplates: false,
        canSeeTeams: true,
        canSeeUsers: false,
      })
    ).toEqual(['teams']);
  });

  it('getVisibleArchiveTabs omits teams when the caller cannot see teams', () => {
    expect(
      getVisibleArchiveTabs({
        canSeeProjects: true,
        canSeeTemplates: true,
        canSeeTeams: false,
        canSeeUsers: true,
      })
    ).not.toContain('teams');
  });

  it('parseArchiveTab accepts teams and ignores unknown tabs', () => {
    expect(parseArchiveTab({tab: 'teams'})).toBe('teams');
    expect(parseArchiveTab({tab: 'nope'})).toBe(DEFAULT_ARCHIVE_TAB);
    expect(parseArchiveTab({})).toBe(config.notebookNamePlural);
  });
});
