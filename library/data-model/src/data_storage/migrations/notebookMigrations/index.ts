import {EncodedNotebook} from '../../../types';
import {migrateToV2} from './migrateV2';
import {migrateToV3} from './migrateV3';

export {migrateToV3} from './migrateV3';

/**
 * Migrate a notebook to the latest version, validating as we go.
 *
 * @param notebook possibly a notebook
 * @returns {changed: boolean, migrated: EncodedNotebook} the migrated notebook, and whether it was changed
 */
export const migrateNotebook = (notebook: any) => {
  let result = notebook;
  let changed = false;

  const schemaVersion = result?.metadata?.schema_version;
  // check the schema version, migrate if not present or version 1.0
  if (
    schemaVersion === undefined ||
    schemaVersion === null ||
    schemaVersion === '1.0'
  ) {
    result = migrateToV2(result);
    changed = true;
  }

  if (result?.metadata?.schema_version === '2.0') {
    result = migrateToV3(result);
    changed = true;
  }

  // TODO: we could validate this against a
  // schema generated from current field types
  // but as yet we don't make use of the fieldPropsSchema
  // that each field defines to do this

  // So we just return this, asserting that it is a notebook
  return {changed, migrated: result as EncodedNotebook};
};
