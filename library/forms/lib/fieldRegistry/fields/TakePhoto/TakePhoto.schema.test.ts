// Copyright 2026 FAIMS Project
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

import {describe, expect, it} from 'vitest';
import {
  TAKE_PHOTO_REQUIRED_MESSAGE,
  takePhotoIsComplete,
  takePhotoValueSchema,
} from './valueSchema';

const requiredSchema = () => takePhotoValueSchema({required: true});
const optionalSchema = () => takePhotoValueSchema({required: false});

describe('takePhotoValueSchema', () => {
  it('rejects an untouched required field with the attachment minimum message', () => {
    for (const value of [undefined, null, []]) {
      const result = requiredSchema().safeParse(value);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          TAKE_PHOTO_REQUIRED_MESSAGE
        );
      }
    }
  });

  it('does not surface Zod\'s raw "expected array" type error', () => {
    const result = requiredSchema().safeParse(undefined);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).not.toMatch(/expected array/i);
    }
  });

  it('accepts one or more attachment ids when required', () => {
    expect(requiredSchema().safeParse(['att-1']).success).toBe(true);
    expect(requiredSchema().safeParse(['a', 'b']).success).toBe(true);
  });

  it('allows an absent or empty value when the field is optional', () => {
    expect(optionalSchema().safeParse(undefined).success).toBe(true);
    expect(optionalSchema().safeParse(null).success).toBe(true);
    expect(optionalSchema().safeParse([]).success).toBe(true);
    expect(optionalSchema().safeParse(['att-1']).success).toBe(true);
  });
});

describe('takePhotoIsComplete', () => {
  it('is incomplete when data is missing, null, or an empty list', () => {
    expect(takePhotoIsComplete({})).toBe(false);
    expect(takePhotoIsComplete({data: undefined})).toBe(false);
    expect(takePhotoIsComplete({data: null})).toBe(false);
    expect(takePhotoIsComplete({data: []})).toBe(false);
  });

  it('is complete when at least one attachment id is stored', () => {
    expect(takePhotoIsComplete({data: ['att-1']})).toBe(true);
  });
});
