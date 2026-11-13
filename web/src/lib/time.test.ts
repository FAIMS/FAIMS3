// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {displayDateTime, displayIsoTimestamp, formatDisplayDate} from './time';

describe('displayDateTime', () => {
  it('uses compact AU DD/MM/YY for the date part', () => {
    const timestamp = new Date(2025, 3, 2, 15, 30, 0).getTime();
    expect(displayDateTime({timestamp})).toMatch(/, 02\/04\/25$/);
  });

  it('pads single-digit day and month', () => {
    const timestamp = new Date(2026, 0, 5, 9, 5, 0).getTime();
    expect(displayDateTime({timestamp})).toMatch(/, 05\/01\/26$/);
  });
});

describe('displayIsoTimestamp', () => {
  it('formats a valid ISO string through displayDateTime', () => {
    const date = new Date(2025, 3, 2, 15, 30, 0);
    expect(displayIsoTimestamp(date.toISOString())).toBe(
      displayDateTime({timestamp: date.getTime()})
    );
  });

  it('returns the original string when unparseable', () => {
    expect(displayIsoTimestamp('not-a-date')).toBe('not-a-date');
  });
});

describe('formatDisplayDate', () => {
  it('uses 24-hour time on compact AU DD/MM/YY', () => {
    const date = new Date(2025, 3, 2, 15, 30, 0);
    expect(formatDisplayDate(date)).toBe('15:30 on 02/04/25');
  });
});
