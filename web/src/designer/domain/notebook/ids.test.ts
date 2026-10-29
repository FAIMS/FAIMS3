// SPDX-License-Identifier: Apache-2.0
/**
 * @file Tests for notebook id helpers.
 */

import {describe, expect, it} from 'vitest';
import {
  buildUniqueExportName,
  isOwnExportNameEcho,
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

describe('isOwnExportNameEcho', () => {
  it('matches the requested string and its slug', () => {
    expect(isOwnExportNameEcho('width', 'width')).toBe(true);
    expect(isOwnExportNameEcho('My Field', 'My-Field')).toBe(true);
  });

  it('matches a numeric uniquify suffix from buildUniqueExportName', () => {
    expect(isOwnExportNameEcho('width', 'width-1')).toBe(true);
    expect(isOwnExportNameEcho('width', 'width-12')).toBe(true);
    expect(isOwnExportNameEcho('My Field', 'My-Field-1')).toBe(true);
  });

  it('does not treat a longer typed suffix as an echo', () => {
    expect(isOwnExportNameEcho('width', 'width-cm')).toBe(false);
    expect(isOwnExportNameEcho('width', 'Site-Name')).toBe(false);
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
