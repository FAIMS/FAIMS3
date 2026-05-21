import {z} from 'zod';

/** Max length for root `description` on stored projects/templates and API input. */
export const ROOT_DESCRIPTION_MAX_LENGTH = 250;

/**
 * Root description when provided (forms, POST create, PUT metadata).
 * Empty or whitespace-only strings are treated as absent on persist.
 */
export const RootDescriptionInputSchema = z
  .string()
  .trim()
  .max(ROOT_DESCRIPTION_MAX_LENGTH, {
    message: `Description must be at most ${ROOT_DESCRIPTION_MAX_LENGTH} characters`,
  });

/** Optional root description on persisted project/template documents (v4/v5). */
export const PersistedRootDescriptionSchema =
  RootDescriptionInputSchema.optional();

/** Optional description on POST /api/notebooks and POST /api/templates. */
export const CreateRootDescriptionSchema = PersistedRootDescriptionSchema;

/** Normalize API/form description for Couch storage (omit when empty). */
export function normalizeRootDescriptionForStore(
  description?: string
): string | undefined {
  const trimmed = description?.trim();
  return trimmed ? trimmed : undefined;
}
