// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import type {Project} from '../context/slices/projectSlice';
import {
  formatNotebookListDescription,
  isNotebookListDescriptionTruncated,
  isProjectActivating,
  partitionNotebookListProjects,
  sortProjectsByNewest,
} from './notebookListDisplay';

describe('notebookListDisplay', () => {
  it('returns null for empty description', () => {
    expect(formatNotebookListDescription(undefined)).toBeNull();
    expect(formatNotebookListDescription('   ')).toBeNull();
  });

  it('returns short descriptions unchanged', () => {
    expect(formatNotebookListDescription('Short blurb')).toBe('Short blurb');
    expect(isNotebookListDescriptionTruncated('Short blurb')).toBe(false);
  });

  it('truncates to 50 characters with ellipsis', () => {
    const long = 'a'.repeat(60);
    expect(formatNotebookListDescription(long)).toBe(`${'a'.repeat(50)}…`);
    expect(isNotebookListDescriptionTruncated(long)).toBe(true);
  });
});

describe('sortProjectsByNewest', () => {
  const p = (updatedAt?: string): Project =>
    ({updatedAt}) as unknown as Project;

  it('sorts by last-updated, newest first', () => {
    const sorted = sortProjectsByNewest([
      p('2024-01-01T00:00:00Z'),
      p('2024-03-01T00:00:00Z'),
      p('2024-02-01T00:00:00Z'),
    ]);
    expect(sorted.map(x => x.updatedAt)).toEqual([
      '2024-03-01T00:00:00Z',
      '2024-02-01T00:00:00Z',
      '2024-01-01T00:00:00Z',
    ]);
  });

  it('sorts projects without a timestamp to the end', () => {
    const sorted = sortProjectsByNewest([
      p(undefined),
      p('2024-01-01T00:00:00Z'),
    ]);
    expect(sorted.map(x => x.updatedAt)).toEqual([
      '2024-01-01T00:00:00Z',
      undefined,
    ]);
  });

  it('does not mutate the input array', () => {
    const input = [p('2024-01-01T00:00:00Z'), p('2024-03-01T00:00:00Z')];
    const before = [...input];
    sortProjectsByNewest(input);
    expect(input).toEqual(before);
  });
});

describe('partitionNotebookListProjects', () => {
  const listed = {
    projectId: 'listed-1',
    serverId: 'server-1',
    isActivated: false,
    updatedAt: '2024-01-01T00:00:00Z',
  } as Project;
  const activating = {
    projectId: 'activating-1',
    serverId: 'server-1',
    isActivated: false,
    updatedAt: '2024-02-01T00:00:00Z',
  } as Project;
  const activated = {
    projectId: 'active-1',
    serverId: 'server-1',
    isActivated: true,
    updatedAt: '2024-03-01T00:00:00Z',
  } as Project;

  it('keeps in-flight activations in the Active list', () => {
    const keys = ['server-1:activating-1'];
    expect(isProjectActivating(activating, keys)).toBe(true);
    const {activatedProjects, availableProjects} =
      partitionNotebookListProjects([listed, activating, activated], keys);
    expect(activatedProjects.map(p => p.projectId)).toEqual([
      'active-1',
      'activating-1',
    ]);
    expect(availableProjects.map(p => p.projectId)).toEqual(['listed-1']);
  });
});
