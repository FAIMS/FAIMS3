import {local_state_db} from '../sync/databases';
import {ProjectID} from './core';

const AUTOINCREMENT_PREFIX = 'local-autoincrement-state';

interface LocalAutoIncrementRange {
  start: number;
  stop: number;
  fully_used: boolean;
  using: boolean;
}

interface LocalAutoIncrementState {
  _id: string;
  _rev?: string;
  last_used_id: number | null;
  ranges: LocalAutoIncrementRange[];
}

function get_pouch_id(
  project_id: ProjectID,
  form_id: string,
  field_id: string
): string {
  return (
    AUTOINCREMENT_PREFIX + '-' + project_id + '-' + form_id + '-' + field_id
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
