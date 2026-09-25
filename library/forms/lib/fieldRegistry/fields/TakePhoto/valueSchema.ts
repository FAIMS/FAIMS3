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
export function takePhotoValueSchema(props: {
  required?: boolean;
}): z.ZodTypeAny {
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
