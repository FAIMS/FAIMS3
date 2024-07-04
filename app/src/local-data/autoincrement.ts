/*
 * Copyright 2021, 2022 Macquarie University
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
import {getProjectDB} from '../sync';
import {getLocalStateDB} from '../sync/databases';
import {
  ProjectID,
  LocalAutoIncrementRange,
  LocalAutoIncrementState,
  AutoIncrementReference,
  AutoIncrementReferenceDoc,
} from 'faims3-datamodel';
import {logError} from '../logging';

const LOCAL_AUTOINCREMENT_PREFIX = 'local-autoincrement-state';
const LOCAL_AUTOINCREMENT_NAME = 'local-autoincrementers';

export interface UserFriendlyAutoincrementStatus {
  label: string;
  last_used: number | null;
  end: number | null;
}

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

export async function getLocalAutoincrementStateForField(
  project_id: ProjectID,
  form_id: string,
  field_id: string
): Promise<LocalAutoIncrementState> {
  const pouch_id = get_pouch_id(project_id, form_id, field_id);
  try {
    const local_state_db = getLocalStateDB();
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
    logError(err);
    throw Error(
      `Unable to get local increment state: ${project_id} ${form_id} ${field_id}`
    );
  }
}

export async function setLocalAutoincrementStateForField(
  new_state: LocalAutoIncrementState
) {
  try {
    const local_state_db = getLocalStateDB();
    // force due to error 409
    return await local_state_db.put(new_state, {force: true});
  } catch (err) {
    logError(err);
    throw Error('Unable to set local increment state');
  }
}

export function createNewAutoincrementRange(
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

export async function getLocalAutoincrementRangesForField(
  project_id: ProjectID,
  form_id: string,
  field_id: string
): Promise<LocalAutoIncrementRange[]> {
  const state = await getLocalAutoincrementStateForField(
    project_id,
    form_id,
    field_id
  );
  return state.ranges;
}

export async function setLocalAutoincrementRangesForField(
  project_id: ProjectID,
  form_id: string,
  field_id: string,
  new_ranges: LocalAutoIncrementRange[]
) {
  const state = await getLocalAutoincrementStateForField(
    project_id,
    form_id,
    field_id
  );
  if (state.ranges.length === 0) {
    state.ranges = new_ranges;
    await setLocalAutoincrementStateForField(state);
  } else {
    // We should check that we're not causing problems for existing ranges
    for (const range of state.ranges) {
      if (range.using) {
        const new_using_range = new_ranges.find(r => r.using);
        if (new_using_range === undefined) {
          throw Error('Currently used range removed');
        } else if (new_using_range.fully_used) {
          new_using_range.using = false;
        } else if (new_using_range.start !== range.start) {
          throw Error('Currently used range start changed');
        } else if (
          state.last_used_id !== null &&
          new_using_range.stop <= state.last_used_id
        ) {
          throw Error('Currently used range stop less than last used ID.');
        }
      }
    }
    // We having broken anything, update ranges and save
    state.ranges = new_ranges;
    await setLocalAutoincrementStateForField(state);
  }
}

export async function getAutoincrementReferencesForProject(
  project_id: ProjectID
): Promise<AutoIncrementReference[]> {
  const projdb = await getProjectDB(project_id);
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
    logError(err);
    throw Error(
      `Unable to get local autoincrement references for ${project_id}`
    );
  }
}

export async function addAutoincrementReferenceForProject(
  project_id: ProjectID,
  form_id: string[],
  field_id: string[],
  label: string[]
) {
  const projdb = await getProjectDB(project_id);
  const refs: Array<AutoIncrementReference> = [];
  form_id.map((id: string, index: number) =>
    refs.push({
      form_id: id,
      field_id: field_id[index],
      label: label[index],
    })
  );
  const refs_add: Array<AutoIncrementReference> = [];
  try {
    const doc: AutoIncrementReferenceDoc = await projdb.get(
      LOCAL_AUTOINCREMENT_NAME
    );
    refs.map((ref: AutoIncrementReference) => {
      let found = false;
      for (const existing_ref of doc.references) {
        if (ref.toString() === existing_ref.toString()) {
          found = true;
        }
      }
      if (!found) {
        refs_add.push(ref);
      }
    });
    doc.references = refs;

    await projdb.put(doc);
  } catch (err: any) {
    if (err.status === 404) {
      // No autoincrementers currently
      await projdb.put({
        _id: LOCAL_AUTOINCREMENT_NAME,
        references: refs,
      });
    } else {
      logError(err); // Unable to add local autoincrement reference
    }
  }
}

export async function removeAutoincrementReferenceForProject(
  project_id: ProjectID,
  form_id: string,
  field_id: string,
  label: string
) {
  const projdb = await getProjectDB(project_id);
  const ref: AutoIncrementReference = {
    form_id: form_id,
    field_id: field_id,
    label: label,
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
    logError(err); // Unable to remove local autoincrement reference
  }
}

async function getDisplayStatusForField(
  project_id: ProjectID,
  form_id: string,
  field_id: string,
  label: string
): Promise<UserFriendlyAutoincrementStatus> {
  const ref_state = await getLocalAutoincrementStateForField(
    project_id,
    form_id,
    field_id
  );
  const last_used = ref_state.last_used_id;
  for (const range of ref_state.ranges) {
    if (range.using) {
      return {
        label: label,
        last_used: last_used,
        end: range.stop,
      };
    }
  }
  return {
    label: label,
    last_used: last_used,
    end: null,
  };
}

export async function getDisplayStatusForProject(
  project_id: ProjectID
): Promise<UserFriendlyAutoincrementStatus[]> {
  const statuses: UserFriendlyAutoincrementStatus[] = [];
  try {
    const refs = await getAutoincrementReferencesForProject(project_id);
    for (const ref of refs) {
      const status = await getDisplayStatusForField(
        project_id,
        ref.form_id,
        ref.field_id,
        ref.label ?? ref.form_id
      );
      statuses.push(status);
    }
  } catch (err) {
    logError(err);
  }
  return statuses;
}
