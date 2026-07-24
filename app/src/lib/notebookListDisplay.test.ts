import {describe, expect, it} from 'vitest';
import type {Project} from '../context/slices/projectSlice';
import {
  formatNotebookListDescription,
  isNotebookListDescriptionTruncated,
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
