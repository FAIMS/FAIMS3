/**
 * @file Tests for notebook id helpers.
 */

import {describe, expect, it} from 'vitest';
import {resolveAddedFieldKey} from './ids';

describe('resolveAddedFieldKey', () => {
  it('uses hrid prefix for the first templated string in a section', () => {
    expect(
      resolveAddedFieldKey(
        'New Field',
        'TemplatedStringField',
        'sectionA',
        [],
        []
      )
    ).toBe('hridsectionA');
  });

  it('slugifies templated string when section already has an hrid field', () => {
    expect(
      resolveAddedFieldKey(
        'New Field',
        'TemplatedStringField',
        'sectionA',
        ['hridsectionA', 'Text-Field'],
        ['hridsectionA', 'Text-Field']
      )
    ).toBe('New-Field');
  });

  it('matches fieldAdded reducer key for standard fields', () => {
    expect(
      resolveAddedFieldKey(
        'New Field',
        'TextField',
        'sectionA',
        ['Existing-Field'],
        ['Existing-Field']
      )
    ).toBe('New-Field');
  });
});
