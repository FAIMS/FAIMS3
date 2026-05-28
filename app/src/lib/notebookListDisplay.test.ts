import {describe, expect, it} from 'vitest';
import {
  formatNotebookListDescription,
  isNotebookListDescriptionTruncated,
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
