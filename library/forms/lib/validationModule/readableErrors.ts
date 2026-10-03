import {z, ZodType} from 'zod';

/** Shown when a required field has no value. */
export const REQUIRED_FIELD_MESSAGE = 'This field is required';

/** Fallback when Zod would otherwise report a type mismatch. */
export const INVALID_VALUE_MESSAGE = 'Enter a valid value';

const RAW_ZOD_MESSAGE =
  /^invalid |invalid input|invalid option|invalid string|invalid literal|expected .+received /i;

/**
 * Rewrite Zod's default type text into a sentence a respondent can act on.
 * Messages that fields already customised are left unchanged.
 */
export function humanizeValidationMessage(message: string): string {
  if (!RAW_ZOD_MESSAGE.test(message)) {
    return message;
  }
  if (/received (undefined|null)/i.test(message)) {
    return REQUIRED_FIELD_MESSAGE;
  }
  if (/invalid option/i.test(message)) {
    return 'Please select a valid option';
  }
  if (/expected array/i.test(message)) {
    return 'Enter one or more values';
  }
  if (/expected string/i.test(message)) {
    return 'Enter valid text';
  }
  if (/expected (number|integer|bigint)/i.test(message)) {
    return 'Enter a valid number';
  }
  if (/expected boolean/i.test(message)) {
    return 'Please choose yes or no';
  }
  return INVALID_VALUE_MESSAGE;
}

type ZodIssueLike = {
  path: PropertyKey[];
  message: string;
};

/**
 * Map Zod issues onto form field ids.
 *
 * Nested paths (`photos.0`, `geometry.type`) are reported on the field itself,
 * because the form only displays errors stored against the field name.
 * The first human-readable message for each field is kept.
 */
export function collectFieldErrorMessages(
  issues: ZodIssueLike[]
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const fieldId = issue.path[0];
    if (fieldId === undefined) {
      continue;
    }
    const key = String(fieldId);
    if (!fieldErrors[key]) {
      fieldErrors[key] = humanizeValidationMessage(issue.message);
    }
  }
  return fieldErrors;
}

/**
 * Turn a missing value into `empty` before the real schema runs.
 *
 * A bare `z.array()` or `z.string()` fails on `undefined` with
 * "expected array, received undefined" and never reaches `.min()` /
 * `.refine()`. Coercing only `null` and `undefined` keeps that check
 * alive inside `z.object()`, including when the key is absent.
 * Other wrong types are left alone so they still fail validation.
 */
export function coerceAbsent<T>(empty: T) {
  return (value: unknown) =>
    value === undefined || value === null ? empty : value;
}

/** Schema that treats a missing value as `empty`, then applies `schema`. */
export function schemaWithAbsent<S extends ZodType>(
  empty: unknown,
  schema: S
): ZodType<z.output<S>> {
  // preprocess widens the input; the cast keeps the inner schema's output.
  return z.preprocess(coerceAbsent(empty), schema) as ZodType<z.output<S>>;
}
