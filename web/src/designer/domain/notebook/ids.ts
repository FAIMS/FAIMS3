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

/**
 * @file Slug helpers for stable field and section ids inside a notebook.
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

/**
 * Picks a slugified field id that does not collide with existing keys.
 *
 * @param preferredName - User-facing label or desired base id.
 * @param existingFieldNames - Current keys in `ui-specification.fields`.
 * @returns Unique slug (may append numeric suffix).
 */
export const buildUniqueFieldName = (
  preferredName: string,
  existingFieldNames: string[]
): string => {
  const taken = new Set(existingFieldNames);
  let candidate = slugify(preferredName);
  let attempt = 1;

  while (taken.has(candidate)) {
    candidate = slugify(`${preferredName} ${attempt}`);
    attempt += 1;
  }

  return candidate;
};

/**
 * Resolves the storage key for a field about to be added via `fieldAdded`.
 * Mirrors reducer logic so UI can expand/focus the new field after dispatch.
 *
 * @param fieldName - Default label passed to `fieldAdded` (e.g. "New Field").
 * @param existingFieldNames - All field keys in the notebook spec.
 */
export const resolveAddedFieldKey = (
  fieldName: string,
  existingFieldNames: string[]
): string => {
  let fieldLabel = slugify(fieldName);

  const taken = new Set(existingFieldNames);
  let suffix = 1;
  while (taken.has(fieldLabel)) {
    fieldLabel = slugify(`${fieldName} ${suffix}`);
    suffix += 1;
  }

  return fieldLabel;
};
