import {NotebookDefinition} from '../../../uiSpecification';
import {migrateToV2} from './migrateV2';
import {migrateToV3} from './migrateV3';
import {migrateToV4} from './migrateV4';

/** Target schema version after {@link migrateNotebook} completes. */
export const CURRENT_NOTEBOOK_UI_SCHEMA_VERSION = '4.0';

type NotebookWithSchemaVersion = {
  metadata?: {schema_version?: string | null};
  uiSpec?: {schemaVersion?: string | null};
};

/**
 * Read schema version from legacy `metadata.schema_version` or v3+
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

  /**
   * Write a migration here - it should restructure the metadata and uiSpec,
   * following the broader refactor. See the project and template migration
   * logic. But no need to do pulling from old metadataDB here - just use the
   * notebook itself. It should also decode the notebook!
   */
  if (getNotebookSchemaVersion(result) === '3.0') {
    // Input type is NotebookAfterV3 (wire)
    // Output type is NotebookDefinition (schema 4.0)
    result = migrateToV4(result);
    changed = true;
  }

  // Should always output the latest schema version
  return {changed, migrated: result as NotebookDefinition};
};
