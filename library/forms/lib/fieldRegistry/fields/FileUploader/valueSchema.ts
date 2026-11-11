// SPDX-License-Identifier: Apache-2.0

import {z} from 'zod';
import {getMinimumItemCount} from '../../utils/itemCountHelpers';

export const FILE_UPLOADER_REQUIRED_MESSAGE = 'At least one file is required';

/** Minimum attachment count validation message. */
export function getFileUploaderMinimumMessage(minimum: number): string {
  return minimum === 1
    ? FILE_UPLOADER_REQUIRED_MESSAGE
    : `At least ${minimum} files are required`;
}

/** Maximum attachment count validation message. */
export function getFileUploaderMaximumMessage(maximum: number): string {
  return `Maximum ${maximum} file${maximum === 1 ? '' : 's'} allowed`;
}

/**
 * Validates attachment IDs against the configured minimum and maximum.
 *
 * Accepts null/undefined so untouched fields receive a minimum count error.
 * Required fields need at least one attachment.
 */
export function fileUploaderValueSchema(props: {
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
          message: getFileUploaderMinimumMessage(minimum),
        });
      }

      if (maximum != null && count > maximum) {
        ctx.addIssue({
          code: 'custom',
          message: getFileUploaderMaximumMessage(maximum),
        });
      }
    });
}
