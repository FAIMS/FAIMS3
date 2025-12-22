import {Record} from '@faims3/data-model';
import {describe, expect, it} from 'vitest';
import {
  formatTimestamp,
  getRecordContextFromRecord,
  prettifyFieldName,
} from './formUtilities';

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

describe('prettifyFieldName', () => {
  it('replaces hyphens with spaces', () => {
    expect(prettifyFieldName('user-name')).toBe('user name');
    expect(prettifyFieldName('shipping-address-details')).toBe(
      'shipping address details'
    );
  });

  it('preserves numeric characters with spacing', () => {
    expect(prettifyFieldName('order123')).toBe('order 123');
    expect(prettifyFieldName('item456status')).toBe('item 456 status');
  });

  it('handles multiple consecutive hyphens', () => {
    expect(prettifyFieldName('user--name')).toBe('user name');
    expect(prettifyFieldName('field---value')).toBe('field value');
  });

  it('handles numeric characters with hyphens', () => {
    expect(prettifyFieldName('user-123-type')).toBe('user 123 type');
    expect(prettifyFieldName('order-98-status-45')).toBe('order 98 status 45');
  });

  it('trims leading and trailing whitespace', () => {
    expect(prettifyFieldName('user-123-')).toBe('user 123');
    expect(prettifyFieldName('-456-status')).toBe('456 status');
  });

  it('handles empty string input', () => {
    expect(prettifyFieldName('')).toBe('');
  });

  it('returns original string with proper spacing', () => {
    expect(prettifyFieldName('username123')).toBe('username 123');
    expect(prettifyFieldName('123status')).toBe('123 status');
  });

  // CamelCase handling tests
  it('splits basic CamelCase', () => {
    expect(prettifyFieldName('userName')).toBe('user Name');
    expect(prettifyFieldName('firstName')).toBe('first Name');
    expect(prettifyFieldName('userPostalCode')).toBe('user Postal Code');
  });

  it('handles consecutive capitals', () => {
    expect(prettifyFieldName('APIResponse')).toBe('API Response');
    expect(prettifyFieldName('JSONData')).toBe('JSON Data');
    expect(prettifyFieldName('userID')).toBe('user ID');
  });

  it('preserves case in split words', () => {
    expect(prettifyFieldName('MyUserName')).toBe('My User Name');
    expect(prettifyFieldName('LastLoginTime')).toBe('Last Login Time');
    expect(prettifyFieldName('UserAPIAccess')).toBe('User API Access');
  });

  it('handles mixed CamelCase and hyphens', () => {
    expect(prettifyFieldName('user-firstName123')).toBe('user first Name 123');
    expect(prettifyFieldName('API-userAccess444')).toBe('API user Access 444');
    expect(prettifyFieldName('MyUser-lastName')).toBe('My User last Name');
  });

  it('handles edge cases with multiple formats', () => {
    expect(prettifyFieldName('UserAPI-123-lastLoginID')).toBe(
      'User API 123 last Login ID'
    );
    expect(prettifyFieldName('first-userName-ID444')).toBe(
      'first user Name ID 444'
    );
    expect(prettifyFieldName('API--userAccessID-999')).toBe(
      'API user Access ID 999'
    );
  });

  it('preserves case in acronyms while splitting', () => {
    expect(prettifyFieldName('MainAPIEndpoint2')).toBe('Main API Endpoint 2');
    expect(prettifyFieldName('UserID123Settings')).toBe('User ID 123 Settings');
    expect(prettifyFieldName('SimpleXMLParser')).toBe('Simple XML Parser');
  });

  it('handles numbers between words', () => {
    expect(prettifyFieldName('user123name')).toBe('user 123 name');
    expect(prettifyFieldName('data42analysis')).toBe('data 42 analysis');
    expect(prettifyFieldName('test789DEBUG123log')).toBe(
      'test 789 DEBUG 123 log'
    );
  });

  it('handles multiple number sequences', () => {
    expect(prettifyFieldName('user123test456')).toBe('user 123 test 456');
    expect(prettifyFieldName('API123Response456')).toBe('API 123 Response 456');
    expect(prettifyFieldName('log42Data99Test')).toBe('log 42 Data 99 Test');
  });
});
