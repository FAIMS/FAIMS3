import {config} from '@/constants';
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
    .refine(
      file => {
        // Some browsers/OS report empty or octet-stream MIME for .json files
        const type = (file.type || '').toLowerCase();
        const name = file.name.toLowerCase();

        const isJson =
          type === 'application/json' ||
          type === 'text/json' ||
          type === '' ||
          type === 'application/octet-stream' ||
          name.endsWith('.json');
        const isXlsform = name.endsWith('.xlsx');
        return isJson || isXlsform;
      },
      {message: 'File must be a JSON (.json) or XlsForm (.xlsx) file.'}
    )
    .refine(file => file.size <= config.maxDesignFileSizeBytes, {
      message: `File must be at most ${config.maxDesignFileSizeMb} MB.`,
    });
}

/**
 * fileToBase64 reads a file and returns a promise with its base64-encoded
 * contents (no data-URL prefix), suitable for sending as JSON.
 */
export function fileToBase64(file: File): Promise<string | null> {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] ?? null;
      resolve(base64);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export {INPUT_LIMITS};
