/*
 * Copyright 2026 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: valueUtils.test.ts
 * Description:
 *   Tests for derived-field value coercion and change detection.
 */

import {
  coerceToExprType,
  hasComputedValueChanged,
  normaliseStoredValue,
} from '../src';

describe('coerceToExprType', () => {
  test('passes numbers through', () => {
    expect(coerceToExprType(42, 'number')).toBe(42);
    expect(coerceToExprType(0, 'number')).toBe(0);
    expect(coerceToExprType(-1.5, 'number')).toBe(-1.5);
  });

  test('coerces numeric strings to numbers', () => {
    expect(coerceToExprType('42', 'number')).toBe(42);
    expect(coerceToExprType('3.14', 'number')).toBe(3.14);
    expect(coerceToExprType('-7', 'number')).toBe(-7);
  });

  test('rejects non-numeric strings for number type', () => {
    expect(coerceToExprType('12abc', 'number')).toBeNull();
    expect(coerceToExprType('abc', 'number')).toBeNull();
  });

  test('treats missing values as null for every type', () => {
    for (const t of ['number', 'string', 'boolean'] as const) {
      expect(coerceToExprType(undefined, t)).toBeNull();
      expect(coerceToExprType(null, t)).toBeNull();
      expect(coerceToExprType('', t)).toBeNull();
    }
  });

  test('is strict for strings', () => {
    expect(coerceToExprType('hello', 'string')).toBe('hello');
    expect(coerceToExprType(42, 'string')).toBeNull();
    expect(coerceToExprType(true, 'string')).toBeNull();
  });

  test('is strict for booleans', () => {
    expect(coerceToExprType(true, 'boolean')).toBe(true);
    expect(coerceToExprType(false, 'boolean')).toBe(false);
    expect(coerceToExprType('true', 'boolean')).toBeNull();
    expect(coerceToExprType(1, 'boolean')).toBeNull();
  });

  test('yields null for an unknown expression type', () => {
    expect(coerceToExprType(42, undefined)).toBeNull();
  });

  test('whitespace-only strings coerce to numbers per Number()', () => {
    // Number('  ') === 0 - documented JS behaviour this function inherits.
    expect(coerceToExprType('  ', 'number')).toBe(0);
  });
});

describe('normaliseStoredValue', () => {
  test('maps blank representations to null', () => {
    expect(normaliseStoredValue(undefined)).toBeNull();
    expect(normaliseStoredValue(null)).toBeNull();
    expect(normaliseStoredValue('')).toBeNull();
  });

  test('passes real values through', () => {
    expect(normaliseStoredValue(0)).toBe(0);
    expect(normaliseStoredValue(false)).toBe(false);
    expect(normaliseStoredValue('x')).toBe('x');
  });
});

describe('hasComputedValueChanged', () => {
  test('no change when both blank, whatever the blank shape', () => {
    expect(hasComputedValueChanged(undefined, null)).toBe(false);
    expect(hasComputedValueChanged(null, null)).toBe(false);
    expect(hasComputedValueChanged('', null)).toBe(false);
  });

  test('change when a value appears or disappears', () => {
    expect(hasComputedValueChanged(null, 5)).toBe(true);
    expect(hasComputedValueChanged(5, null)).toBe(true);
  });

  test('no change for identical values', () => {
    expect(hasComputedValueChanged(5, 5)).toBe(false);
    expect(hasComputedValueChanged('a', 'a')).toBe(false);
    expect(hasComputedValueChanged(false, false)).toBe(false);
  });

  test('NaN compares equal to NaN (no rewrite loop)', () => {
    expect(hasComputedValueChanged(NaN, NaN)).toBe(false);
  });

  test('zero and negative zero differ under Object.is', () => {
    expect(hasComputedValueChanged(0, -0)).toBe(true);
  });
});
