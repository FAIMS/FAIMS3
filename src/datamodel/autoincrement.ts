/*
 * Copyright 2021 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: autoincrement.ts
 * Description:
 *   TODO
 */

// There are two internal IDs for projects, the former is unique to the system
// (i.e. includes the listing_id), the latter is unique only to the 'projects'
// database it came from, for a FAIMS listing
// (It is this way because the list of projects is decentralised and so we
// cannot enforce system-wide unique project IDs without a 'namespace' listing id)
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
  } catch (err: any) {
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

export async function get_local_autoincrement_ranges_for_field(
  project_id: ProjectID,
  form_id: string,
  field_id: string
): Promise<LocalAutoIncrementRange[]> {
  const state = await get_local_autoincrement_state_for_field(
    project_id,
    form_id,
    field_id
  );
  return state.ranges;
}

export async function set_local_autoincrement_ranges_for_field(
  project_id: ProjectID,
  form_id: string,
  field_id: string,
  new_ranges: LocalAutoIncrementRange[]
) {
  const state = await get_local_autoincrement_state_for_field(
    project_id,
    form_id,
    field_id
  );
  if (state.ranges.length === 0) {
    state.ranges = new_ranges;
    await set_local_autoincrement_state_for_field(state);
  } else {
    // We should check that we're not causing problems for existing ranges
    for (const range of state.ranges) {
      if (range.fully_used && !new_ranges.includes(range)) {
        throw Error('Fully used range removed');
      } else if (range.using) {
        const new_using_range = new_ranges.find(r => r.using);
        if (new_using_range === undefined) {
          throw Error('Currently used range removed');
        } else if (new_using_range.start !== range.start) {
          throw Error('Currently used range start changed');
        } else if (new_using_range.stop < range.stop) {
          throw Error('Currently used range stop reduced');
        }
      }
    }
    // We having broken anything, update ranges and save
    state.ranges = new_ranges;
    await set_local_autoincrement_state_for_field(state);
  }
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
  } catch (err: any) {
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
  form_id: string[],
  field_id: string[]
) {
  const projdb = getProjectDB(project_id);
  const ref: AutoIncrementReference[] = [];
  form_id.map((formid: string, index: number) =>
    ref.push({
      project_id: project_id,
      form_id: formid,
      field_id: field_id[index],
    })
  );
  try {
    const doc: AutoIncrementReferenceDoc = await projdb.get(
      LOCAL_AUTOINCREMENT_NAME
    );
    const ref_set = new Set(doc.references);
    ref.map((r: AutoIncrementReference) => ref_set.add(r));
    doc.references = Array.from(ref_set.values());
    await projdb.put(doc);
  } catch (err: any) {
    if (err.status === 404) {
      // No autoincrementers currently
      await projdb.put({
        _id: LOCAL_AUTOINCREMENT_NAME,
        references: ref,
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
