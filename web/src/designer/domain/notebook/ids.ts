// SPDX-License-Identifier: Apache-2.0

/**
 * @file Slug helpers plus minted storage ids and unique export names.
 */

/**
 * Slugify a string, replacing special characters with less special ones.
 *
 * @param value - Raw name or label.
 * @returns URL-safe version of the string.
 * @see https://ourcodeworld.com/articles/read/255/creating-url-slugs-properly-in-javascript-including-transliteration-for-utf-8
 */
export const slugify = (value: string): string => {
  let result = value.trim();
  //str = str.toLowerCase();
  // remove accents, swap ñ for n, etc
  const from = 'ãàáäâáº½èéëêìíïîõòóöôùúüûñç·/_,:;';
  const to = 'aaaaaeeeeeiiiiooooouuuunc------';

  for (let i = 0; i < from.length; i += 1) {
    result = result.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
  }

  return result
    .replace(/[^A-Za-z0-9 -]/g, '') // remove invalid chars
    .replace(/\s+/g, '-') // collapse whitespace and replace by -
    .replace(/-+/g, '-'); // collapse dashes
};

/**
 * Strip ASCII control characters from a user-supplied display label.
 *
 * Printable characters (including quotes) are kept for display. Callers that
 * interpolate labels into HTTP headers or filenames must still sanitise for
 * that context.
 */
export const sanitizeUserLabel = (label: string): string =>
  Array.from(label)
    .filter(ch => {
      const code = ch.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('')
    .trim();

/** Used when a label slugifies to empty (e.g. `!!!`) so export names stay non-empty. */
const EMPTY_SLUG_FALLBACK = 'field';

/**
 * Picks a slug that does not collide with existing names (field keys or export names).
 *
 * @param preferredName - User-facing label or desired base id.
 * @param existingFieldNames - Names that must remain unique.
 * @returns Unique non-empty slug (may append numeric suffix).
 */
export const buildUniqueFieldName = (
  preferredName: string,
  existingFieldNames: string[]
): string => {
  const taken = new Set(existingFieldNames);
  const base = slugify(preferredName) || EMPTY_SLUG_FALLBACK;
  let candidate = base;
  let attempt = 1;

  while (taken.has(candidate)) {
    candidate = `${base}-${attempt}`;
    attempt += 1;
  }

  return candidate;
};

/** Hex chars after `f_` in a minted storage id (24 bits). */
const STORAGE_ID_HEX_LENGTH = 6;

/**
 * Mint an opaque, immutable storage id (`f_` + random hex) that does not
 * collide with existing `uiSpec.fields` keys.
 */
export const mintFieldStorageId = (existingFieldNames: string[]): string => {
  const taken = new Set(existingFieldNames);
  let candidate: string;
  do {
    candidate = `f_${crypto.randomUUID().replace(/-/g, '').slice(0, STORAGE_ID_HEX_LENGTH)}`;
  } while (taken.has(candidate));
  return candidate;
};

/**
 * Unique export / column name among existing export names (slug + suffix).
 */
export const buildUniqueExportName = (
  preferredName: string,
  existingExportNames: string[]
): string => buildUniqueFieldName(preferredName, existingExportNames);
