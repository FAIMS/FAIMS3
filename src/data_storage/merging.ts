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
 * Filename: merging.ts
 * Description:
 *   TODO
 */

import {getDataDB} from '../sync';
import {
  AttributeValuePairID,
  RecordID,
  ProjectID,
  RevisionID,
} from '../datamodel/core';
import {
  AttributeValuePair,
  AttributeValuePairMap,
  AttributeValuePairIDMap,
  EncodedRecord,
  RecordMap,
  Revision,
  RevisionMap,
} from '../datamodel/database';
import {
  addNewRevisionFromForm,
  generateFAIMSRevisionID,
  getRecord,
  getRevision,
  getFormDataFromRevision,
  updateHeads,
} from './internals';

type RevisionCache = {[revision_id: string]: Revision};

class MergeResult {
  private _state: string | undefined = undefined;

  set_trivial() {
    if (this._state === undefined) {
      this._state = 'trivial';
    }
  }

  set_merge_us() {
    if (this._state === undefined || this._state === 'trivial') {
      this._state = 'merged_us';
    } else if (this._state === 'merged_them') {
      this._state = 'merged_both';
    }
  }

  set_merge_them() {
    if (this._state === undefined || this._state === 'trivial') {
      this._state = 'merged_them';
    } else if (this._state === 'merged_us') {
      this._state = 'merged_both';
    }
  }

  set_no_merge() {
    this._state = 'no_merge';
  }

  is_successful(): boolean {
    if (this._state === 'no_merge') {
      return false;
    }
    return true;
  }
}

async function getAutomergeCreator(project_id: ProjectID): Promise<string> {
  // TODO: Work out what the correct value should be
  return 'automerge';
}

async function getCachedRevision(
  project_id: ProjectID,
  revision_cache: RevisionCache,
  revision_id: RevisionID
): Promise<Revision> {
  let revision = revision_cache[revision_id];
  if (revision === undefined) {
    revision = await getRevision(project_id, revision_id);
    revision_cache[revision_id] = revision;
  }
  return revision;
}

async function getBaseRevision(
  project_id: ProjectID,
  revision_cache: RevisionCache,
  them: Revision,
  us: Revision
): Promise<Revision> {
  const revisions_seen = new Set();
  // We're going to start with us
  const to_check = [them];
  let current_revision: Revision | undefined = us;
  while (to_check.length !== 0) {
    if (current_revision === undefined) {
      current_revision = to_check.shift();
      continue;
    }
    if (revisions_seen.has(current_revision._id)) {
      return current_revision;
    }
    revisions_seen.add(current_revision._id);
    for (const parent_id in current_revision.parents) {
      const parent = await getCachedRevision(
        project_id,
        revision_cache,
        parent_id
      );
      to_check.push(parent);
    }
    current_revision = to_check.shift();
  }
  throw Error('no shared revisions!');
}

function getAttributes(base: Revision, them: Revision, us: Revision): string[] {
  const attributes = new Set<string>();
  for (const attr in base.avps) {
    attributes.add(attr);
  }
  for (const attr in them.avps) {
    attributes.add(attr);
  }
  for (const attr in us.avps) {
    attributes.add(attr);
  }
  return Array.from(attributes);
}

export async function do3WayMerge(
  project_id: ProjectID,
  revision_cache: RevisionCache,
  them_id: RevisionID,
  us_id: RevisionID
): Promise<MergeResult> {
  const datadb = getDataDB(project_id);
  const avp_map: AttributeValuePairIDMap = {};
  const merge_result = new MergeResult();
  const them = await getCachedRevision(project_id, revision_cache, them_id);
  const us = await getCachedRevision(project_id, revision_cache, us_id);

  const base = await getBaseRevision(project_id, revision_cache, them, us);
  const attrs = getAttributes(base, them, us);
  for (const attr in attrs) {
    const base_avp_id = base.avps[attr];
    const their_avp_id = them.avps[attr];
    const our_avp_id = us.avps[attr];
    if (their_avp_id === our_avp_id) {
      // The avp is the same on both heads, the trivial case
      avp_map[attr] = our_avp_id;
      merge_result.set_trivial();
    } else {
      // We're going to need to do a merge
      if (their_avp_id === base_avp_id) {
        // We're the ones with the change
        avp_map[attr] = our_avp_id;
        merge_result.set_merge_us();
      } else if (our_avp_id === base_avp_id) {
        // They're the ones with the change
        avp_map[attr] = their_avp_id;
        merge_result.set_merge_them();
      } else {
        // Both us and them have changed the field, we can't automerge
        merge_result.set_no_merge();
      }
    }
  }

  if (merge_result.is_successful()) {
    const new_revision_id = generateFAIMSRevisionID();
    const creation_time = new Date();
    const creator = await getAutomergeCreator(project_id);
    const parents = [us_id, them_id].sort();

    const new_revision: Revision = {
      _id: new_revision_id,
      revision_format_version: 1,
      avps: avp_map,
      record_id: us.record_id,
      parents: parents,
      created: creation_time.toISOString(),
      created_by: creator,
      // TODO: Work out how to handle changing types if that's going to be a
      // thing
      type: us.type,
    };
    await datadb.put(new_revision);
    await updateHeads(project_id, us.record_id, parents, new_revision_id);
  }
  return merge_result;
}
