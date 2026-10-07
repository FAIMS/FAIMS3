// SPDX-License-Identifier: Apache-2.0
/**
 * @file Tests for notebook id helpers.
 */

import {describe, expect, it} from 'vitest';
import {
  buildUniqueExportName,
  mintFieldStorageId,
  sanitizeUserLabel,
} from './ids';

describe('mintFieldStorageId', () => {
  it('always starts with f_', () => {
    expect(mintFieldStorageId([])).toMatch(/^f_[0-9a-f]{6}$/);
  });
});

describe('buildUniqueExportName', () => {
  it('slugifies the preferred name', () => {
    expect(buildUniqueExportName('New Field', [])).toBe('New-Field');
  });

  it('deduplicates against existing export names', () => {
    expect(
      buildUniqueExportName('New Field', ['New-Field', 'Text-Field'])
    ).toBe('New-Field-1');
  });

  it('falls back when the preferred name slugifies to empty', () => {
    expect(buildUniqueExportName('!!!', [])).toBe('field');
    expect(buildUniqueExportName('!!!', ['field'])).toBe('field-1');
    expect(buildUniqueExportName('   ', ['field', 'field-1'])).toBe('field-2');
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
