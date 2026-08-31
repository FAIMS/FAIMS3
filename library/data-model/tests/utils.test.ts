import {formatFileSize, formatTimestamp} from '../src/utils';

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
