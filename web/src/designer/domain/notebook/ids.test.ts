// SPDX-License-Identifier: Apache-2.0
/**
 * @file Tests for notebook id helpers.
 */

import {describe, expect, it} from 'vitest';
import {
  buildUniqueExportName,
  mintFieldStorageId,
  resolveAddedFieldKey,
  sanitizeUserLabel,
} from './ids';

describe('resolveAddedFieldKey', () => {
  it('mints an opaque storage id', () => {
    expect(resolveAddedFieldKey('New Field', [])).toMatch(/^f_[0-9a-f]{12}$/);
  });

  it('does not collide with existing keys', () => {
    const existing = ['f_aaaaaaaaaaaa'];
    const id = resolveAddedFieldKey('New Field', existing);
    expect(existing).not.toContain(id);
    expect(id).toMatch(/^f_[0-9a-f]{12}$/);
  });

  it('ignores the label when choosing the storage key', () => {
    expect(resolveAddedFieldKey('New Field', [])).not.toBe('New-Field');
  });
});

describe('mintFieldStorageId', () => {
  it('always starts with f_', () => {
    expect(mintFieldStorageId([])).toMatch(/^f_[0-9a-f]{12}$/);
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
