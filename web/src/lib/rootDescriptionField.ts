import type {Field} from '@/components/form';
import {
  ROOT_DESCRIPTION_MAX_LENGTH,
  PersistedRootDescriptionSchema,
} from '@faims3/data-model';

/** Optional description field for create/edit survey or template forms. */
export function optionalRootDescriptionField(options?: {
  label?: string;
  helperText?: string;
}): Field {
  return {
    name: 'description',
    label: options?.label ?? 'Description',
    description:
      options?.helperText ??
      `Optional (up to ${ROOT_DESCRIPTION_MAX_LENGTH} characters)`,
    // Optional schema: an untouched field is `undefined`, which must validate
    // so the description is not treated as required.
    schema: PersistedRootDescriptionSchema,
    maxLength: ROOT_DESCRIPTION_MAX_LENGTH,
  };
}

/** Trimmed description for POST create bodies; omitted when empty. */
export function rootDescriptionForApi(description?: string): {
  description?: string;
} {
  const trimmed = description?.trim();
  return trimmed ? {description: trimmed} : {};
}
