import {describe, expect, test} from 'vitest';
import fuzzysort from 'fuzzysort';
import {
  hasFuzzysortKeyMatch,
  renderFuzzysortHighlight,
} from './renderFuzzysortHighlight';

describe('hasFuzzysortKeyMatch', () => {
  test('returns false for fuzzysort placeholder results on non-matching keys', () => {
    const [match] = fuzzysort.go(
      'first helper',
      [
        {
          label: 'Alpha Widget',
          id: 'field-a',
          helperText: 'First helper',
          advancedHelperText: '',
        },
      ],
      {
        keys: ['label', 'id', 'helperText', 'advancedHelperText'],
        threshold: 0.15,
      }
    );

    expect(hasFuzzysortKeyMatch(match[0])).toBe(false);
    expect(hasFuzzysortKeyMatch(match[2])).toBe(true);
  });
});

describe('renderFuzzysortHighlight', () => {
  test('falls back to plain text when the key did not match', () => {
    const [match] = fuzzysort.go(
      'first helper',
      [
        {
          label: 'Alpha Widget',
          id: 'field-a',
          helperText: 'First helper',
          advancedHelperText: '',
        },
      ],
      {
        keys: ['label', 'id', 'helperText', 'advancedHelperText'],
        threshold: 0.15,
      }
    );

    expect(renderFuzzysortHighlight(match[0], 'Alpha Widget')).toBe(
      'Alpha Widget'
    );
  });
});
