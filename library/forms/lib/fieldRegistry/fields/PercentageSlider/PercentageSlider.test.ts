// SPDX-License-Identifier: Apache-2.0

import {describe, expect, it} from 'vitest';
import {formatPercentageViewValue, percentageSliderFieldSpec} from './index';

describe('formatPercentageViewValue', () => {
  it('appends a percent sign to rounded integer values', () => {
    expect(formatPercentageViewValue(42)).toBe('42%');
    expect(formatPercentageViewValue(42.6)).toBe('43%');
  });

  it('renders zero as 0%', () => {
    expect(formatPercentageViewValue(0)).toBe('0%');
  });

  it('returns null for empty or non-numeric values', () => {
    expect(formatPercentageViewValue(null)).toBeNull();
    expect(formatPercentageViewValue(undefined)).toBeNull();
    expect(formatPercentageViewValue('not-a-number')).toBeNull();
  });
});

describe('PercentageSlider value schema', () => {
  const schema = (params: Record<string, unknown>) =>
    percentageSliderFieldSpec.fieldDataSchemaFunction!(params as any);

  it('accepts values on the step grid', () => {
    const s = schema({min: 0, max: 100, step: 10});
    expect(s.safeParse(30).success).toBe(true);
    expect(s.safeParse(0).success).toBe(true);
    expect(s.safeParse(100).success).toBe(true);
  });

  it('rejects values off the step grid', () => {
    const s = schema({min: 0, max: 100, step: 10});
    expect(s.safeParse(31).success).toBe(false);
  });

  it('enforces min and max from props', () => {
    const s = schema({min: 10, max: 40, step: 5});
    expect(s.safeParse(9).success).toBe(false);
    expect(s.safeParse(41).success).toBe(false);
    expect(s.safeParse(25).success).toBe(true);
  });
});
