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
 * Filename: parentReferencesEncoding.test.ts
 * Description:
 *   Tests for reference encoding, decoding and classification.
 */

import {
  CREATED_TIME_ID,
  CREATOR_NAME_ID,
  decodeParentRef,
  encodeParentRef,
  isParentRef,
  resolveRefType,
} from '../src';

describe('parent reference encoding', () => {
  test('encode then decode round-trips a field ID', () => {
    expect(decodeParentRef(encodeParentRef('Field-B'))).toBe('Field-B');
  });

  test('encodes with the expected prefix shape', () => {
    expect(encodeParentRef('Field-A')).toBe('_PARENT.Field-A');
  });

  test('decodes a field ID containing dots', () => {
    expect(decodeParentRef('_PARENT.a.b.c')).toBe('a.b.c');
  });

  test('returns null for a non-parent reference', () => {
    expect(decodeParentRef('Field-A')).toBeNull();
  });

  test('returns null for a bare prefix with no field ID', () => {
    expect(decodeParentRef('_PARENT.')).toBeNull();
  });

  test('isParentRef distinguishes parent references from similar names', () => {
    expect(isParentRef('_PARENT.Field-A')).toBe(true);
    expect(isParentRef('_PARENTAL-FIELD')).toBe(false);
    expect(isParentRef('Field-A')).toBe(false);
    expect(isParentRef('')).toBe(false);
  });
});

describe('resolveRefType', () => {
  test('classifies parent references', () => {
    expect(resolveRefType('_PARENT.Field-A')).toBe('PARENT_FIELD');
  });

  test('classifies system references', () => {
    expect(resolveRefType(CREATOR_NAME_ID)).toBe('SYSTEM');
    expect(resolveRefType(CREATED_TIME_ID)).toBe('SYSTEM');
  });

  test('classifies everything else as a local field', () => {
    expect(resolveRefType('Field-A')).toBe('FIELD');
    expect(resolveRefType('')).toBe('FIELD');
  });

  test('a parent reference to a system-named field is still a parent ref', () => {
    expect(resolveRefType(encodeParentRef(CREATOR_NAME_ID))).toBe(
      'PARENT_FIELD'
    );
  });
});
