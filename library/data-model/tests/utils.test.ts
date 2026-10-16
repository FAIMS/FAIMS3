// SPDX-License-Identifier: Apache-2.0
import {
  EMPTY_EXPORT_COLUMN_FALLBACK,
  formatFileSize,
  formatTimestamp,
  MAX_EXPORT_COLUMN_NAME_LENGTH,
  sanitizeExportColumnName,
  uniqueExportColumnName,
} from '../src/utils';

describe('formatFileSize', () => {
  const KB = 1024;
  const MB = KB * 1024;
  const GB = MB * 1024;
  const TB = GB * 1024;

  describe('zero', () => {
    it('formats 0 bytes', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
    });
  });

  describe('sub-1KB values stay in Bytes', () => {
    it('formats a small byte count', () => {
      expect(formatFileSize(500)).toBe('500 Bytes');
    });

    it('formats the largest sub-1KB value', () => {
      expect(formatFileSize(KB - 1)).toBe('1023 Bytes');
    });
  });

  describe('unit boundaries', () => {
    it('formats exactly 1 KB', () => {
      expect(formatFileSize(KB)).toBe('1 KB');
    });

    it('formats exactly 1 MB', () => {
      expect(formatFileSize(MB)).toBe('1 MB');
    });

    it('formats exactly 1 GB', () => {
      expect(formatFileSize(GB)).toBe('1 GB');
    });

    it('rounds within a unit to two decimal places', () => {
      expect(formatFileSize(1.5 * MB)).toBe('1.5 MB');
    });
  });

  describe('terabyte-scale values', () => {
    it('formats exactly 1 TB without an undefined unit', () => {
      const result = formatFileSize(TB);
      expect(result).toBe('1 TB');
      expect(result).not.toMatch(/undefined/);
    });

    it('formats a value above 1 TB without an undefined unit', () => {
      const result = formatFileSize(2.5 * TB);
      expect(result).toBe('2.5 TB');
      expect(result).not.toMatch(/undefined/);
    });
  });

  describe('non-finite and negative input is guarded', () => {
    it('rejects negative sizes', () => {
      expect(formatFileSize(-1)).toBe('Invalid size');
    });

    it('rejects NaN', () => {
      expect(formatFileSize(NaN)).toBe('Invalid size');
    });

    it('rejects positive Infinity', () => {
      expect(formatFileSize(Infinity)).toBe('Invalid size');
    });

    it('rejects negative Infinity', () => {
      expect(formatFileSize(-Infinity)).toBe('Invalid size');
    });
  });

  describe('formatTimestamp', () => {
    it('formats a valid timestamp correctly in UTC', () => {
      const timestamp = 1705324200000;
      expect(formatTimestamp(timestamp, 'GMT')).toBe('15-01-24 1:10pm');
    });

    it('handles morning times correctly in UTC', () => {
      const timestamp = 1705306200000;
      expect(formatTimestamp(timestamp, 'GMT')).toBe('15-01-24 8:10am');
    });

    it('handles noon correctly in UTC', () => {
      const timestamp = 1705315200000;
      expect(formatTimestamp(timestamp, 'GMT')).toBe('15-01-24 10:40am');
    });

    it('handles midnight correctly in UTC', () => {
      const timestamp = 1705276800000;
      expect(formatTimestamp(timestamp, 'GMT')).toBe('15-01-24 12:00am');
    });

    it('handles different timezones', () => {
      const timestamp = 1705324200000;
      expect(formatTimestamp(timestamp, 'GMT')).toBe('15-01-24 1:10pm');
      expect(formatTimestamp(timestamp, 'Australia/Sydney')).toBe(
        '16-01-24 12:10am'
      );
    });

    it('handles invalid inputs gracefully', () => {
      expect(formatTimestamp(null)).toBe('');
      expect(formatTimestamp(undefined)).toBe('');
      expect(formatTimestamp(NaN)).toBe('');
      expect(formatTimestamp(Infinity)).toBe('');
      expect(formatTimestamp('invalid')).toBe('');
    });

    it('handles string timestamps', () => {
      const timestamp = '1705324200000';
      expect(formatTimestamp(timestamp, 'GMT')).toBe('15-01-24 1:10pm');
    });

    it('defaults to local timezone when no timezone specified', () => {
      const timestamp = 1705324200000;
      const result = formatTimestamp(timestamp);
      expect(result).toMatch(/^\d{2}-\d{2}-\d{2} \d{1,2}:\d{2}(am|pm)$/);
    });
  });
});

describe('sanitizeExportColumnName', () => {
  it('leaves designer-produced names unchanged', () => {
    expect(sanitizeExportColumnName('Site-Name')).toBe('Site-Name');
    expect(sanitizeExportColumnName('Feature-description')).toBe(
      'Feature-description'
    );
    expect(sanitizeExportColumnName('safety_hazard')).toBe('safety_hazard');
    expect(sanitizeExportColumnName('Length-mm')).toBe('Length-mm');
  });

  it('strips CR/LF so extra CSV rows or headers cannot be injected', () => {
    expect(sanitizeExportColumnName('Form\r\nX-Injected: yes')).toBe(
      'FormX-Injected_yes'
    );
    expect(sanitizeExportColumnName('Form\u0000Name')).toBe('FormName');
  });

  it('strips quotes used to break CSV / KML attributes', () => {
    expect(sanitizeExportColumnName('Form"; filename="evil.html')).toBe(
      'Form_filename_evil.html'
    );
  });

  it('collapses path separators so the name cannot be treated as a path', () => {
    expect(sanitizeExportColumnName('../../../etc/passwd')).toBe('etc_passwd');
    expect(sanitizeExportColumnName('foo\\bar')).toBe('foo_bar');
  });

  it('neutralises Excel formula prefixes', () => {
    expect(sanitizeExportColumnName('=cmd|calc')).toBe('cmd_calc');
    expect(sanitizeExportColumnName('+1+2')).toBe('1_2');
    expect(sanitizeExportColumnName('@SUM(A1)')).toBe('SUM_A1');
    expect(sanitizeExportColumnName('-hidden')).toBe('hidden');
  });

  it('falls back when the value is only unsafe characters', () => {
    expect(sanitizeExportColumnName('"""')).toBe(EMPTY_EXPORT_COLUMN_FALLBACK);
    expect(sanitizeExportColumnName('=+-@')).toBe(EMPTY_EXPORT_COLUMN_FALLBACK);
    expect(sanitizeExportColumnName('"""', 'column')).toBe('column');
  });

  it('is idempotent', () => {
    const once = sanitizeExportColumnName('Site/Name\r\n');
    expect(sanitizeExportColumnName(once)).toBe(once);
  });

  it('truncates names longer than the column-name limit', () => {
    const long = `Site-${'A'.repeat(200)}`;
    const sanitised = sanitizeExportColumnName(long);
    expect(sanitised.length).toBeLessThanOrEqual(MAX_EXPORT_COLUMN_NAME_LENGTH);
    expect(sanitised.startsWith('Site-')).toBe(true);
  });
});

describe('uniqueExportColumnName', () => {
  it('returns the sanitised name when it is free', () => {
    const used = new Set<string>();
    expect(uniqueExportColumnName('Site-Name', used)).toBe('Site-Name');
    expect(used.has('Site-Name')).toBe(true);
  });

  it('appends a suffix when two raw names sanitise to the same column', () => {
    const used = new Set<string>();
    expect(uniqueExportColumnName('foo/bar', used)).toBe('foo_bar');
    expect(uniqueExportColumnName('foo_bar', used)).toBe('foo_bar_1');
  });
});
