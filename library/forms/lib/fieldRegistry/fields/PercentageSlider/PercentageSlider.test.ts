// Copyright 2023 FAIMS Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

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
