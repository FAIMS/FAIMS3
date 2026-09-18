// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: parentReferences.ts
 * Description:
 *   Encoding, decoding and classification of expression/template references.
 *   A reference is a symbol used by a computed expression or template:
 *   a plain field ID, a parent-record field (prefixed), or a system value.
 */

import {PARENT_REFERENCE_PREFIX} from './parentForms';
import {splitRelatedReference} from './relatedForms';
import {isMetadataRef} from './metadataReferences';

/** Classification of a reference used in expressions and templates. */
export type RefType =
  | 'SYSTEM'
  | 'FIELD'
  | 'PARENT_FIELD'
  | 'RELATED_FIELD'
  | 'METADATA';

/** System variable: the record creator's name, injectable into templates. */
export const CREATOR_NAME_ID = '_CREATOR_NAME';
/** System variable: the record's created time, injectable into templates. */
export const CREATED_TIME_ID = '_CREATED_TIME';

/** System reference IDs injectable into templates and expressions. */
const SYSTEM_REFERENCE_IDS: ReadonlySet<string> = new Set([
  CREATOR_NAME_ID,
  CREATED_TIME_ID,
]);

/** Encodes a parent field ID as a parent reference (_PARENT.<Field-ID>). */
export function encodeParentRef(fieldId: string): string {
  return `${PARENT_REFERENCE_PREFIX}${fieldId}`;
}

/**
 * Decodes a parent reference to its field ID. Returns null when the input is
 * not a parent reference or carries no field ID (a bare prefix).
 */
export function decodeParentRef(ref: string): string | null {
  if (!isParentRef(ref)) {
    return null;
  }
  const fieldId = ref.slice(PARENT_REFERENCE_PREFIX.length);
  return fieldId.length > 0 ? fieldId : null;
}

/** Whether a reference addresses a parent record field. */
export function isParentRef(ref: string): boolean {
  return ref.startsWith(PARENT_REFERENCE_PREFIX);
}

/** Whether a reference addresses a field on a linked record
 * (<Rel-Field-ID>.<Field-ID>). Field IDs cannot contain dots, so any dotted
 * reference that is neither a parent nor a metadata reference is related. */
export function isRelatedRef(ref: string): boolean {
  return (
    !isParentRef(ref) &&
    !isMetadataRef(ref) &&
    splitRelatedReference(ref) !== null
  );
}

/**
 * Classifies a reference: SYSTEM for injected system values, PARENT_FIELD for
 * parent-record references, METADATA for notebook metadata references,
 * RELATED_FIELD for linked-record references, FIELD for anything else (a local
 * field ID).
 */
export function resolveRefType(ref: string): RefType {
  if (isParentRef(ref)) {
    return 'PARENT_FIELD';
  }
  if (SYSTEM_REFERENCE_IDS.has(ref)) {
    return 'SYSTEM';
  }
  if (isMetadataRef(ref)) {
    return 'METADATA';
  }
  if (isRelatedRef(ref)) {
    return 'RELATED_FIELD';
  }
  return 'FIELD';
}
