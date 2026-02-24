import {EncodedNotebook} from '../../../types';
import {migrateToV2} from './migrateV2';

/**
 * Migrate a notebook to the latest version, validating as we go.
 *
 * @param notebook possibly a notebook
 * @returns {changed: boolean, migrated: EncodedNotebook} the migrated notebook, and whether it was changed
 */
export const migrateNotebook = (notebook: any) => {
  const schemaVersion = notebook?.metadata?.schema_version;
  let result = notebook;
  let changed = false;

  // check the schema version, migrate if not present or version 1.0
  if (
    schemaVersion === undefined ||
    schemaVersion === null ||
    schemaVersion === '1.0'
  ) {
    result = migrateToV2(notebook);
    changed = true;
  }

  // TODO: we could validate this against a
  // schema generated from current field types
  // but as yet we don't make use of the fieldPropsSchema
  // that each field defines to do this

  // So we just return this, asserting that it is a notebook
  return {changed, migrated: result as EncodedNotebook};
};
