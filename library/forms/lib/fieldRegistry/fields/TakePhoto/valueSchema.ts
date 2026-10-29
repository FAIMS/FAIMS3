// SPDX-License-Identifier: Apache-2.0

import {FormDataEntry} from '@faims3/data-model';
import {z} from 'zod';
import {getMinimumItemCount} from '../../utils/itemCountHelpers';

/** User-facing message when at least one photo is required. */
export const TAKE_PHOTO_REQUIRED_MESSAGE = 'At least one photo is required';

/** Minimum photo count validation message. */
export function getTakePhotoMinimumMessage(minimum: number): string {
  return minimum === 1
    ? TAKE_PHOTO_REQUIRED_MESSAGE
    : `At least ${minimum} photos are required`;
}

/** Maximum photo count validation message. */
export function getTakePhotoMaximumMessage(maximum: number): string {
  return `Maximum ${maximum} photo${maximum === 1 ? '' : 's'} allowed`;
}

/**
 * Validate the number of stored photo attachment IDs.
 *
 * A bare `z.array()` fails on an untouched field before count validation runs.
 * Include null and undefined in the union so empty required/minimum fields
 * receive a useful message, even when the field is missing from a z.object.
 *
 * Required means at least one photo; null/undefined limits are unrestricted.
 * Do not use `.nullish()` / `.optional()` around the schema: a missing object
 * key could then skip the count validation.
 */
export function takePhotoValueSchema(props: {
  required?: boolean;
  minItems?: number | null;
  maxItems?: number | null;
}): z.ZodTypeAny {
  const minimum = getMinimumItemCount(props);
  const maximum = props.maxItems;

  return z
    .union([z.array(z.string()), z.null(), z.undefined()])
    .superRefine((value, ctx) => {
      const count = value?.length ?? 0;

      if (count < minimum) {
        ctx.addIssue({
          code: 'custom',
          message: getTakePhotoMinimumMessage(minimum),
        });
      }

      if (maximum != null && count > maximum) {
        ctx.addIssue({
          code: 'custom',
          message: getTakePhotoMaximumMessage(maximum),
        });
      }
    });
}

/** At least one stored attachment ID. Empty / absent photos are incomplete. */
export function takePhotoIsComplete(formData: FormDataEntry): boolean {
  return Array.isArray(formData.data) && formData.data.length > 0;
}
