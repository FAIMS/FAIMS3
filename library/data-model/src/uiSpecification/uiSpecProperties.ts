// SPDX-License-Identifier: Apache-2.0
import {z} from 'zod';
import {createHash} from '../data_storage/utils';
import {
  getNotebookSchemaVersion,
  type NotebookWithSchemaVersion,
} from '../data_storage/migrations/notebookMigrations/version';

/** SHA-256 digest encoded as lowercase hex. */
export const UI_SPECIFICATION_HASH_HEX_LENGTH = 64;

/**
 * Closed digest of a stored `uiSpecification` bundle. Written whenever the
 * design is created or replaced; listing views emit this instead of the bundle.
 */
export const UiSpecPropertiesSchema = z
  .object({
    schemaVersion: z.string().min(1),
    hash: z.string().length(UI_SPECIFICATION_HASH_HEX_LENGTH),
  })
  .strict();
export type UiSpecProperties = z.infer<typeof UiSpecPropertiesSchema>;

/**
 * Stable stringify: sorts object keys so logically identical values
 * serialise identically regardless of key order.
 */
export const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map(k => `${JSON.stringify(k)}:${stableStringify(record[k])}`)
    .join(',')}}`;
};

/**
 * SHA-256 hex digest of the normalised `uiSpecification` (notebook or
 * template definition) that is actually stored.
 */
export async function hashUiSpecification(
  definition: unknown
): Promise<string> {
  return createHash(stableStringify(definition));
}

/**
 * Build the mandatory {@link UiSpecProperties} for a stored design bundle.
 * Throws when the schema version cannot be read — callers must persist a
 * real version, not a placeholder.
 */
export async function buildUiSpecProperties(
  definition: unknown
): Promise<UiSpecProperties> {
  const schemaVersion = getNotebookSchemaVersion(
    (definition ?? {}) as NotebookWithSchemaVersion
  );
  if (!schemaVersion) {
    throw new Error(
      'Cannot build uiSpecProperties: uiSpecification has no schemaVersion.'
    );
  }
  const hash = await hashUiSpecification(definition);
  return {schemaVersion, hash};
}
