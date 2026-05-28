import type {NotebookDefinition} from '../../../uiSpecification/types';
import {migrateToV2} from './migrateV2';
import {migrateToV3} from './migrateV3';
import {migrateToV4} from './migrateV4';
import {migrateToV5} from './migrateV5';

/** Target schema version after {@link migrateNotebook} completes. */
export const CURRENT_NOTEBOOK_UI_SCHEMA_VERSION = '5.0';

type NotebookWithSchemaVersion = {
  metadata?: {schema_version?: string | null};
  uiSpec?: {schemaVersion?: string | null};
};

/**
 * Read schema version from legacy `metadata.schema_version` or current
 * `uiSpec.schemaVersion` (see {@link NotebookUiSpec}).
 */
export function getNotebookSchemaVersion(
  notebook: NotebookWithSchemaVersion
): string | undefined {
  const legacy = notebook.metadata?.schema_version;
  if (legacy != null) {
    return legacy;
  }
  const fromUiSpec = notebook.uiSpec?.schemaVersion;
  if (fromUiSpec != null) {
    return fromUiSpec;
  }
  return undefined;
}

export {migrateToV3} from './migrateV3';
export {migrateToV4} from './migrateV4';
export {migrateToV5} from './migrateV5';

/**
 * Migrate a notebook to the latest version, validating as we go.
 *
 * @param notebook possibly a notebook
 * @returns {changed: boolean, migrated: EncodedNotebook} the migrated notebook, and whether it was changed
 */
export const migrateNotebook = (
  notebook: any
): {changed: boolean; migrated: NotebookDefinition} => {
  let result = notebook;
  let changed = false;

  const schemaVersion = getNotebookSchemaVersion(result);
  // check the schema version, migrate if not present or version 1.0
  if (
    schemaVersion === undefined ||
    schemaVersion === null ||
    schemaVersion === '1.0'
  ) {
    // Input type is NotebookV1
    // Output type is NotebookV2
    result = migrateToV2(result);
    changed = true;
  }

  if (getNotebookSchemaVersion(result) === '2.0') {
    // Input type is NotebookAfterV2
    // Output type is NotebookAfterV3
    result = migrateToV3(result);
    changed = true;
  }

  if (getNotebookSchemaVersion(result) === '3.0') {
    // Input type is NotebookAfterV3
    // Output type is NotebookAfterV4 (legacy wire, canonical field names)
    result = migrateToV4(result);
    changed = true;
  }

  if (getNotebookSchemaVersion(result) === '4.0') {
    // Input type is NotebookAfterV4
    // Output type is NotebookDefinition (current schema)
    result = migrateToV5(result);
    changed = true;
  }

  // Should always output the latest schema version
  return {changed, migrated: result as NotebookDefinition};
};
