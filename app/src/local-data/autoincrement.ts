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
 *   Manage autoincrementer state for a project
 */

import {
  getFieldToIdsMap,
  ProjectID,
  ProjectUIFields,
  safeWriteDocument,
} from '@faims3/data-model';
import {compiledSpecService} from '../context/slices/helpers/compiledSpecService';
import {selectProjectById} from '../context/slices/projectSlice';
import {store} from '../context/store';
import {logError} from '../logging';
import {
  databaseService,
  LocalStateDbType,
} from '../context/slices/helpers/databaseService';
import {
  AutoIncrementReference,
  LocalAutoIncrementRange,
  LocalAutoIncrementState,
  UserFriendlyAutoincrementStatus,
} from './autoincrementTypes';
import {PouchDBWrapper} from '../context/slices/helpers/pouchDBWrapper';

const LOCAL_AUTOINCREMENT_PREFIX = 'local-autoincrement-state';
export const DEFAULT_NUM_DIGITS = 4;

// An auto-incrementer allocates numbers from a set of ranges
// defined by the user.
// One range will be active at any time.
// The incrementer yields a number from the current range
// until it is exhausted, then moves to the next range.
// The current state is stored in the local_state database
export class AutoIncrementer {
  private project_id: ProjectID;
  private form_id: string;
  private field_id: string;
  private pouch_id: string;
  private db: PouchDBWrapper<LocalStateDbType>;

  constructor(project_id: ProjectID, form_id: string, field_id: string) {
    this.project_id = project_id;
    this.form_id = form_id;
    this.field_id = field_id;
    // document id for this autoincrementer
    this.pouch_id = `${LOCAL_AUTOINCREMENT_PREFIX}-${project_id}-${form_id}-${field_id}`;
    this.db = databaseService.getLocalStateDatabase();
  }

  // get the current state for this incrementer from the database or initialise
  // it if it doesn't exist
  async getState() {
    try {
      const doc = await this.db.get(this.pouch_id);
      return doc as LocalAutoIncrementState;
    } catch (err: any) {
      if (err.status === 404) {
        // We haven't initialised this yet
        const doc: LocalAutoIncrementState = {
          _id: this.pouch_id,
          last_used_id: null,
          ranges: [],
        };
        // store the initial state
        await this.setState(doc);
        return doc;
      }
      logError(err);
      throw Error(
        `Unable to get local increment state: ${this.project_id} ${this.form_id} ${this.field_id}`
      );
    }
  }

  // update the state for this incrementer
  async setState(state: LocalAutoIncrementState) {
    try {
      await safeWriteDocument({db: this.db, data: state, writeOnClash: true});
    } catch (err) {
      logError(err);
      throw Error('Unable to set local increment state');
    }
  }

  // set the last used id for this incrementer
  async setLastUsed(last_used_id: number) {
    const state = await this.getState();
    // value should be in one of the ranges, that range becomes the
    // new active range, overriding any previous active range
    if (state.ranges.length === 0) {
      throw Error('No ranges defined for this autoincrementer');
    }
    let in_range = false;
    for (const range of state.ranges) {
      if (last_used_id >= range.start && last_used_id <= range.stop) {
        in_range = true;
        range.using = true;
        range.fully_used = last_used_id === range.stop;
      } else if (in_range) {
        // if we already found the range, set any later ranges to not using
        range.using = false;
      } else {
        // if we haven't found the range yet, set any earlier ranges to full used
        range.fully_used = true;
        range.using = false;
      }
    }
    if (!in_range) {
      throw Error('Last used ID not in any defined range');
    }
    state.last_used_id = last_used_id;
    await this.setState(state);
  }

  // Add a new range to the autoincrementer
  async addRange({start, stop}: {start: number; stop: number}) {
    const doc: LocalAutoIncrementRange = {
      start: start,
      stop: stop,
      fully_used: false,
      using: false,
    };
    const state = await this.getState();
    state.ranges.push(doc);
    await this.setState(state);
    return doc;
  }

  // Remove a range given an index
  async removeRange(index: number) {
    const state = await this.getState();
    if (index < 0 || index >= state.ranges.length) {
      throw Error('Index out of range');
    }
    const range = state.ranges[index];
    if (range.using) {
      throw Error('Cannot remove a range that is currently in use');
    }
    state.ranges.splice(index, 1);
    await this.setState(state);
  }

  async updateRange(index: number, newRange: LocalAutoIncrementRange) {
    const state = await this.getState();
    if (index < 0 || index >= state.ranges.length) {
      throw Error('Index out of range');
    }
    const range = state.ranges[index];
    if (range.using) {
      if (newRange.fully_used) {
        newRange.using = false;
      } else if (newRange.start !== range.start) {
        throw Error("Can't change start of currently used range");
      } else if (
        state.last_used_id !== null &&
        newRange.stop <= state.last_used_id
      ) {
        throw Error('Currently used range stop less than last used ID.');
      }
    }
    state.ranges[index] = newRange;
    await this.setState(state);
  }

  // get the current ranges for this autoincrementer
  async getRanges() {
    const state = await this.getState();
    return state.ranges;
  }

  // return the next value for this autoincrementer, or undefined if we can't
  // get one
  async nextValue() {
    const state = await this.getState();
    // find the range in use
    if (state.last_used_id === null && state.ranges.length === 0) {
      // no ranges allocated, can't get a value
      return undefined;
    }

    if (state.last_used_id === null) {
      // We've got a clean slate with ranges allocated, start allocating ids
      const new_id = state.ranges[0].start;
      state.ranges[0].using = true;
      state.last_used_id = new_id;
      await this.setState(state);
      return new_id;
    }
    // We're now using the allocated ranges, find where we've up to:
    // If we're using a range, find it
    for (const range of state.ranges) {
      if (range.using) {
        if (state.last_used_id! + 1 <= range.stop) {
          const next_id = state.last_used_id! + 1;
          state.last_used_id = next_id;
          await this.setState(state);
          return next_id;
        } else {
          // mark the range as fully used
          range.fully_used = true;
          range.using = false;
        }
      }
    }

    // find a new range to use - first one that isn't fully used
    for (const range of state.ranges) {
      if (!range.fully_used) {
        const next_id = range.start;
        range.using = true;
        state.last_used_id = next_id;
        await this.setState(state);
        return next_id;
      }
    }
    // we've got no new ranges to use, can't get a value
    return undefined;
  }

  // return the status of auto incrementers for a field
  async getDisplayStatus(
    label: string
  ): Promise<UserFriendlyAutoincrementStatus> {
    const ref_state = await this.getState();
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
}

/**
 * Derive an autoincrementers object from a UI Spec
 *   find all of the autoincrement fields in the UISpec and create an
 *   entry for each of them.
 * @param project_id the project identifier
 * @returns an autoincrementers object suitable for insertion into the db or
 *          undefined if there are no such fields
 */
export async function getAutoincrementReferencesForProject(
  project_id: ProjectID
): Promise<AutoIncrementReference[]> {
  const uiSpecId = selectProjectById(
    store.getState(),
    project_id
  )?.uiSpecificationId;
  const uiSpec = uiSpecId ? compiledSpecService.getSpec(uiSpecId) : undefined;
  if (!uiSpec) {
    console.error(
      'Failed to find uiSpec during auto incrementer initialisation.'
    );
    return [];
  }

  // build a lookup of field -> viewset
  const viewsetMap = getFieldToIdsMap(uiSpec);
  const references: AutoIncrementReference[] = [];

  const fields = (uiSpec?.fields ?? []) as ProjectUIFields;
  for (const [fieldId, fieldDetails] of Object.entries(fields)) {
    if (fieldDetails['component-name'] === 'BasicAutoIncrementer') {
      // Default
      let numDigits: number = DEFAULT_NUM_DIGITS;
      if (fieldDetails['component-parameters'].num_digits) {
        try {
          numDigits = Number(fieldDetails['component-parameters'].num_digits);
        } catch {}
      }

      references.push({
        form_id: viewsetMap[fieldId].viewSetId,
        field_id: fieldDetails['component-parameters'].name,
        label: fieldDetails['component-parameters'].label,
        numDigits: numDigits,
      });
    }
  }

  return references;
}

// return the status of auto incrementers for a field
async function getDisplayStatusForField(
  project_id: ProjectID,
  form_id: string,
  field_id: string,
  label: string
): Promise<UserFriendlyAutoincrementStatus> {
  const incrementer = new AutoIncrementer(project_id, form_id, field_id);
  const ref_state = await incrementer.getState();
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

// return the status of all auto incrementers in a project so
// that we can display them to the user
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
