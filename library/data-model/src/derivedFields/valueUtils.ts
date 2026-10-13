// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: valueUtils.ts
 * Description:
 *   Value coercion and change detection for derived-field evaluation.
 */

import {ExprType, ExprValue} from '../uiSpecification';

/**
 * Coerces a raw form value to the given expression type, or null when missing
 * or mistyped. Numbers may arrive as strings from form controls, so numeric
 * strings coerce; other types are strict. Empty string counts as missing so
 * partially filled forms stay blank. An unknown or absent expression type
 * yields null.
 */
export function coerceToExprType(
  raw: unknown,
  exprType: ExprType | undefined
): ExprValue | null {
  if (!exprType) {
    return null;
  }
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }
  switch (exprType) {
    case 'number': {
      const n = typeof raw === 'number' ? raw : Number(raw);
      return Number.isNaN(n) ? null : n;
    }
    case 'string':
      return typeof raw === 'string' ? raw : null;
    case 'boolean':
      return typeof raw === 'boolean' ? raw : null;
  }
}

/**
 * Normalises a stored form value for change comparison: undefined, null and
 * empty string all compare as null, since each displays as blank and a
 * recompute yielding blank must not register as a change against any of them.
 */
export function normaliseStoredValue(value: unknown): ExprValue | null {
  return value === undefined || value === null || value === ''
    ? null
    : (value as ExprValue);
}

/**
 * Whether a recomputed value differs from the stored one, after normalising
 * blanks. Object.is semantics: NaN equals NaN (a NaN result written once does
 * not rewrite forever), and 0 and -0 differ.
 */
export function hasComputedValueChanged(
  stored: unknown,
  computed: ExprValue | null
): boolean {
  return !Object.is(normaliseStoredValue(stored), computed);
}
