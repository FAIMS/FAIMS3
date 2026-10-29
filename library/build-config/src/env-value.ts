// SPDX-License-Identifier: Apache-2.0

/** Scalar or CSV-array value written into a generated env map. */
export type EnvValue =
  | string
  | number
  | boolean
  | undefined
  | null
  | Array<string | number | boolean>;

/**
 * Convert a build-config env value to a string (for container / bundler env maps).
 * Arrays become CSV; booleans become `'true'`/`'false'`; numbers are stringified.
 * `undefined` and `null` return `undefined` so callers can omit unset keys.
 */
export function envValueToString(value: EnvValue): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value.join(',');
  return String(value);
}

/** Escape newlines so a value can be written as a single `.env` line. */
export function escapeEnvNewlines(value: string): string {
  return value.replace(/\r?\n/g, '\\n');
}
