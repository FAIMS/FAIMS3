import {MAX_DESIGN_FILE_SIZE_BYTES, MAX_DESIGN_FILE_SIZE_MB} from '@/constants';
import {INPUT_LIMITS} from '@faims3/data-model';
import {z} from 'zod';

/**
 * Client-side helpers mirroring the shared server-side input limits
 * (see `library/data-model/src/inputLimits.ts`). Keeping the same bounds on
 * both sides means users get immediate feedback in the UI while the API
 * remains the enforcement point of record.
 */

/** Bounded name schema for projects, templates and teams. */
export function resourceNameSchema(minLength: number, label: string) {
  return z
    .string()
    .trim()
    .min(minLength, {
      message: `${label} must be at least ${minLength} characters.`,
    })
    .max(INPUT_LIMITS.RESOURCE_NAME_MAX_LENGTH, {
      message: `${label} must be at most ${INPUT_LIMITS.RESOURCE_NAME_MAX_LENGTH} characters.`,
    });
}

/** Uploaded notebook/template design JSON: must be JSON and within size cap. */
export function designFileSchema() {
  return z
    .instanceof(File)
    .refine(file => file.type === 'application/json', {
      message: 'File must be a JSON file.',
    })
    .refine(file => file.size <= MAX_DESIGN_FILE_SIZE_BYTES, {
      message: `File must be at most ${MAX_DESIGN_FILE_SIZE_MB} MB.`,
    });
}

export {INPUT_LIMITS};
