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
 * Filename: metadataReferences.ts
 * Description:
 *   Encodes and decodes _METADATA.<key> references to the notebook's custom
 *   metadata, usable in computed expressions, templates and conditions. Keys
 *   are not part of the uiSpec, so references are typed by prefix (every
 *   metadata value is a string) and an undefined key reads as blank at
 *   runtime. Shared by the compile pass, the designer and the forms runtime.
 */

import {ExprType} from './expressions';

/** Reserved prefix addressing a key in the notebook's custom metadata. */
export const METADATA_REFERENCE_PREFIX = '_METADATA.';

/** Keys usable in references: letters, digits, hyphen, underscore. Dots break
 * template lookup (Mustache nesting), spaces and braces break the reference
 * syntax itself. */
export const METADATA_KEY_PATTERN = /^[A-Za-z0-9_-]+$/;

/** Whether a custom metadata key can be referenced in expressions, templates
 * and conditions. Unsafe keys still work as plain metadata - they are just
 * not offered or accepted as references. */
export function isReferenceableMetadataKey(key: string): boolean {
  return METADATA_KEY_PATTERN.test(key);
}

/** Every metadata value is a string. */
export const METADATA_EXPR_TYPE: ExprType = 'string';

/** Encodes a metadata key as a reference (_METADATA.<key>). */
export function encodeMetadataRef(key: string): string {
  return `${METADATA_REFERENCE_PREFIX}${key}`;
}

/** Whether a reference addresses a notebook metadata value. */
export function isMetadataRef(ref: string): boolean {
  return ref.startsWith(METADATA_REFERENCE_PREFIX);
}

/**
 * Decodes a metadata reference to its key. Returns null when the input is not
 * a metadata reference or carries no key (a bare prefix).
 */
export function decodeMetadataRef(ref: string): string | null {
  if (!isMetadataRef(ref)) {
    return null;
  }
  const key = ref.slice(METADATA_REFERENCE_PREFIX.length);
  return key.length > 0 ? key : null;
}
