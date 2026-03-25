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
 * Normalise a human-readable label into a URL-safe id fragment (accents stripped).
 *
 * @param value - Raw name or label.
 * @returns Slug suitable for field / section ids inside the notebook.
 */
export const slugify = (value: string): string => {
  let result = value.trim();
  const from = 'ãàáäâáº½èéëêìíïîõòóöôùúüûñç·/_,:;';
  const to = 'aaaaaeeeeeiiiiooooouuuunc------';

  for (let i = 0; i < from.length; i += 1) {
    result = result.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
  }

  return result
    .replace(/[^A-Za-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

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
