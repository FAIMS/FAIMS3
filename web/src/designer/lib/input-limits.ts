import {INPUT_LIMITS} from '@faims3/data-model';

/**
 * Shared HTML maxLength helpers for Notebook Designer free-text inputs.
 * Prefer DebouncedTextField (which defaults to LONG_TEXT); use these for
 * plain MUI TextFields that are not yet migrated.
 */

export function designerHtmlInput(
  maxLength: number = INPUT_LIMITS.LONG_TEXT_MAX_LENGTH,
  extra: Record<string, unknown> = {}
) {
  return {maxLength, ...extra};
}

export {INPUT_LIMITS};
