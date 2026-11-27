// SPDX-License-Identifier: Apache-2.0
/**
 * Stable stringify so logically identical values hash identically regardless
 * of key insertion order. `undefined` fields are omitted, as `JSON.stringify`
 * does.
 *
 * `keepUndefined` instead writes them as `"key":undefined`. Only
 * {@link stableStringify} uses it: stored `uiSpecification` hashes were
 * computed that way and must not change.
 */
export function stableCanonicalJson(
  value: unknown,
  {keepUndefined = false}: {keepUndefined?: boolean} = {}
): string {
  const stringify = (current: unknown): string => {
    if (current === null || typeof current !== 'object') {
      return JSON.stringify(current);
    }
    if (Array.isArray(current)) {
      return `[${current.map(item => stringify(item)).join(',')}]`;
    }
    const record = current as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .filter(key => keepUndefined || record[key] !== undefined)
      .map(key => `${JSON.stringify(key)}:${stringify(record[key])}`)
      .join(',')}}`;
  };
  return stringify(value);
}
