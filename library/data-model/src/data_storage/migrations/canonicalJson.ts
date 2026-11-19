// SPDX-License-Identifier: Apache-2.0
/**
 * Stable stringify so logically identical values hash identically regardless
 * of key insertion order. `undefined` fields are omitted.
 */
export function stableCanonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableCanonicalJson).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .filter(key => record[key] !== undefined)
    .map(key => `${JSON.stringify(key)}:${stableCanonicalJson(record[key])}`)
    .join(',')}}`;
}
