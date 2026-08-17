import {Record} from '@faims3/data-model';
import {describe, expect, it} from 'vitest';
import {formatTimestamp, getRecordContextFromRecord} from './formUtilities';

/**
 * Test suite for form utility functions including time stamp and templating logic
 */

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

describe('getRecordContextFromRecord', () => {
  it('creates context from a valid record', () => {
    const record = {
      created: new Date(1705324200000),
      created_by: 'John Smith',
    } as Record;

    const context = getRecordContextFromRecord({record});
    expect(context.createdTime).toBe(1705324200000);
    expect(context.createdBy).toBe('John Smith');
  });

  it('handles missing fields gracefully', () => {
    const record = {} as Record;
    const context = getRecordContextFromRecord({record});
    expect(context.createdTime).toBeUndefined();
    expect(context.createdBy).toBeUndefined();
  });
});
