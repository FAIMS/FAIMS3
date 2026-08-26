/**
 * @file Tests for notebook id helpers.
 */

import {describe, expect, it} from 'vitest';
import {resolveAddedFieldKey, sanitizeUserLabel} from './ids';

describe('resolveAddedFieldKey', () => {
  it('slugifies templated string fields like any other field', () => {
    expect(resolveAddedFieldKey('New Field', [])).toBe('New-Field');
  });

  it('deduplicates when the slug is already taken', () => {
    expect(resolveAddedFieldKey('New Field', ['New-Field', 'Text-Field'])).toBe(
      'New-Field-1'
    );
  });

  it('matches fieldAdded reducer key for standard fields', () => {
    expect(resolveAddedFieldKey('New Field', ['Existing-Field'])).toBe(
      'New-Field'
    );
  });
});

describe('sanitizeUserLabel', () => {
  it('keeps ordinary form names', () => {
    expect(sanitizeUserLabel('Site Survey')).toBe('Site Survey');
  });

  it('strips CR/LF and other control characters', () => {
    expect(sanitizeUserLabel('Form\r\nInjected')).toBe('FormInjected');
    expect(sanitizeUserLabel('Form\u0000Name')).toBe('FormName');
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeUserLabel('  Form  ')).toBe('Form');
  });
});
