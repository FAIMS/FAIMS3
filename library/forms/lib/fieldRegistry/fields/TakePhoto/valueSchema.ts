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

import {FormDataEntry} from '@faims3/data-model';
import {z} from 'zod';

/** User-facing Zod message when a required TakePhoto field has no attachments. */
export const TAKE_PHOTO_REQUIRED_MESSAGE = 'At least one photo is required';

/**
 * Attachment IDs, or absent (`undefined` / `null`) when the field was never set.
 *
 * A bare `z.array()` fails on `undefined` with Zod's type error
 * ("expected array, received undefined") before any required-length refine
 * can run. Accept the empty state first so required fields surface the
 * attachment-minimum message instead.
 *
 * Do not use `.nullish()` / `.optional()` here: Zod then treats a missing
 * object key as skipped, so an untouched required photo would pass when the
 * form schema is compiled as `z.object(...)`.
 */
export function takePhotoValueSchema(props: {required?: boolean}) {
  const ids = z.union([z.array(z.string()), z.null(), z.undefined()]);
  if (props.required) {
    return ids.refine(val => (val ?? []).length > 0, {
      message: TAKE_PHOTO_REQUIRED_MESSAGE,
    });
  }
  return ids;
}

/** At least one stored attachment ID. Empty / absent photos are incomplete. */
export function takePhotoIsComplete(formData: FormDataEntry): boolean {
  return Array.isArray(formData.data) && formData.data.length > 0;
}
