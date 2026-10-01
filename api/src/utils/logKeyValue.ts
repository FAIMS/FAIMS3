// SPDX-License-Identifier: Apache-2.0

/** Optional `key=value` fields for {@link logKeyValue}; undefined values are omitted. */
export type LogKeyValueFields = Record<
  string,
  string | number | boolean | undefined
>;

/** One line: `<prefix> <event> key=value ...` (undefined fields omitted). */
export function logKeyValue(
  prefix: string,
  event: string,
  fields: LogKeyValueFields = {}
): void {
  const detail = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ');
  console.log(
    detail.length > 0 ? `${prefix} ${event} ${detail}` : `${prefix} ${event}`
  );
}
