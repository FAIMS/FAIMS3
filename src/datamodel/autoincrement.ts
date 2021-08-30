import {getProjectDB} from '../sync/index';
import {local_state_db} from '../sync/databases';
import {ProjectID} from './core';
import {
  LOCAL_AUTOINCREMENT_PREFIX,
  LOCAL_AUTOINCREMENT_NAME,
  LocalAutoIncrementRange,
  LocalAutoIncrementState,
  AutoIncrementReference,
  AutoIncrementReferenceDoc,
} from './database';

function get_pouch_id(
  project_id: ProjectID,
  form_id: string,
  field_id: string
): string {
  return (
    LOCAL_AUTOINCREMENT_PREFIX +
    '-' +
    project_id +
    '-' +
    form_id +
    '-' +
    field_id
  );
}

export async function get_local_autoincrement_state_for_field(
  project_id: ProjectID,
  form_id: string,
  field_id: string
): Promise<LocalAutoIncrementState> {
  const pouch_id = get_pouch_id(project_id, form_id, field_id);
  try {
    return await local_state_db.get(pouch_id);
  } catch (err) {
    if (err.status === 404) {
      // We haven't initialised this yet
      const doc = {
        _id: pouch_id,
        last_used_id: null,
        ranges: [],
      };
      return doc;
    }
    console.error(err);
    throw Error('Unable to get local increment state');
  }
}

export async function set_local_autoincrement_state_for_field(
  new_state: LocalAutoIncrementState
) {
  try {
    return await local_state_db.put(new_state);
  } catch (err) {
    console.error(err);
    throw Error('Unable to set local increment state');
  }
}

export function create_new_autoincrement_range(
  start: number,
  stop: number
): LocalAutoIncrementRange {
  const doc: LocalAutoIncrementRange = {
    start: start,
    stop: stop,
    fully_used: false,
    using: false,
  };
  return doc;
}

export async function get_autoincrement_references_for_project(
  project_id: ProjectID
): Promise<AutoIncrementReference[]> {
  const projdb = getProjectDB(project_id);
  try {
    const doc: AutoIncrementReferenceDoc = await projdb.get(
      LOCAL_AUTOINCREMENT_NAME
    );
    return doc.references;
  } catch (err) {
    if (err.status === 404) {
      // No autoincrementers
      return [];
    }
    console.error(err);
    throw Error('Unable to get local autoincrement references');
  }
}

export async function add_autoincrement_reference_for_project(
  project_id: ProjectID,
  form_id: string,
  field_id: string
) {
  const projdb = getProjectDB(project_id);
  const ref: AutoIncrementReference = {
    project_id: project_id,
    form_id: form_id,
    field_id: field_id,
  };
  try {
    const doc: AutoIncrementReferenceDoc = await projdb.get(
      LOCAL_AUTOINCREMENT_NAME
    );
    const ref_set = new Set(doc.references);
    ref_set.add(ref);
    doc.references = Array.from(ref_set.values());
    await projdb.put(doc);
  } catch (err) {
    if (err.status === 404) {
      // No autoincrementers currently
      await projdb.put({
        _id: LOCAL_AUTOINCREMENT_NAME,
        references: [ref],
      });
    } else {
      console.error(err);
      throw Error('Unable to add local autoincrement reference');
    }
  }
}

export async function remove_autoincrement_reference_for_project(
  project_id: ProjectID,
  form_id: string,
  field_id: string
) {
  const projdb = getProjectDB(project_id);
  const ref: AutoIncrementReference = {
    project_id: project_id,
    form_id: form_id,
    field_id: field_id,
  };
  try {
    const doc: AutoIncrementReferenceDoc = await projdb.get(
      LOCAL_AUTOINCREMENT_NAME
    );
    const ref_set = new Set(doc.references);
    ref_set.delete(ref);
    doc.references = Array.from(ref_set.values());
    await projdb.put(doc);
  } catch (err) {
    console.error(err);
    throw Error('Unable to remove local autoincrement reference');
  }
}
