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
import {RecordID, ProjectID, RevisionID} from '../datamodel/core';
import {AttributeValuePairIDMap, Revision} from '../datamodel/database';
import {
  generateFAIMSRevisionID,
  getRecord,
  getRevision,
  getRevisions,
  updateHeads,
} from './internals';

type RevisionCache = {[revision_id: string]: Revision};

class MergeResult {
  private _state: string | undefined = undefined;
  private _new_revision_id: RevisionID | undefined = undefined;

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

  set_fast_forward(revision_id: RevisionID) {
    this._state = 'fast_forward';
    this.add_new_revision(revision_id);
  }

  is_successful(): boolean {
    if (this._state === undefined) {
      throw Error('Merge was not attempted');
    }
    if (this._state === 'no_merge') {
      return false;
    }
    return true;
  }

  add_new_revision(revision_id: RevisionID) {
    this._new_revision_id = revision_id;
  }

  get_new_revision_id(): RevisionID {
    if (this._new_revision_id === undefined) {
      throw Error('Merge did not succeed, no new revision created');
    }
    return this._new_revision_id;
  }
}

async function getAutomergeCreator(project_id: ProjectID): Promise<string> {
  // TODO: Work out what the correct value should be
  return 'automerge' + (project_id as string);
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
  while (true) {
    console.debug('To check', to_check);
    console.debug('Current revision', current_revision);
    if (current_revision === undefined) {
      break;
    }
    if (revisions_seen.has(current_revision._id)) {
      return current_revision;
    }
    revisions_seen.add(current_revision._id);
    console.debug('Seen', revisions_seen);
    for (const parent_id of current_revision.parents) {
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

function canFastForward(base: Revision, them: Revision, us: Revision): boolean {
  if (base._id === them._id) {
    return true;
  }
  if (base._id === us._id) {
    return true;
  }
  return false;
}

async function doFastForward(
  project_id: ProjectID,
  merge_result: MergeResult,
  base: Revision,
  them: Revision,
  us: Revision
): Promise<MergeResult> {
  if (base._id === them._id) {
    merge_result.set_fast_forward(us._id);
    await updateHeads(project_id, us.record_id, [them._id, base._id], us._id);
  }
  if (base._id === us._id) {
    merge_result.set_fast_forward(them._id);
    await updateHeads(project_id, them.record_id, [us._id, base._id], them._id);
  }
  return merge_result;
}

export async function do3WayMerge(
  project_id: ProjectID,
  revision_cache: RevisionCache,
  them_id: RevisionID,
  us_id: RevisionID
): Promise<MergeResult> {
  console.debug(`merging ${us_id} and ${them_id}`);
  const datadb = getDataDB(project_id);
  const avp_map: AttributeValuePairIDMap = {};
  const merge_result = new MergeResult();
  const them = await getCachedRevision(project_id, revision_cache, them_id);
  const us = await getCachedRevision(project_id, revision_cache, us_id);

  const base = await getBaseRevision(project_id, revision_cache, them, us);
  console.debug('Base revision:', base);
  if (canFastForward(base, them, us)) {
    return await doFastForward(project_id, merge_result, base, them, us);
  }

  if (them.type !== us.type) {
    // Because changing types it unsupported:
    throw Error('Merging of revisions with differing types is unsupported');
  }

  const attrs = getAttributes(base, them, us);
  for (const attr of attrs) {
    const base_avp_id = base.avps[attr];
    const their_avp_id = them.avps[attr];
    const our_avp_id = us.avps[attr];
    if (base_avp_id === undefined) {
      throw Error(`base_avp ${attr} is undefined`);
    }
    if (their_avp_id === undefined) {
      throw Error(`their_avp ${attr} is undefined`);
    }
    if (our_avp_id === undefined) {
      throw Error(`our_avp ${attr} is undefined`);
    }
    console.error(base_avp_id, their_avp_id, our_avp_id);
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

    merge_result.add_new_revision(new_revision_id);

    const new_revision: Revision = {
      _id: new_revision_id,
      revision_format_version: 1,
      avps: avp_map,
      record_id: us.record_id,
      parents: parents,
      created: creation_time.toISOString(),
      created_by: creator,
      deleted: us.deleted && them.deleted ? true : false,
      // TODO: Work out how to handle changing types if that's going to be a
      // thing
      type: us.type,
    };
    await datadb.put(new_revision);
    await updateHeads(project_id, us.record_id, parents, new_revision_id);
  }
  return merge_result;
}

export async function mergeHeads(
  project_id: ProjectID,
  record_id: RecordID,
  initial_cache_size = 100
): Promise<boolean> {
  let fully_merged: boolean | undefined = undefined;
  const record = await getRecord(project_id, record_id);
  const revision_ids_to_seed_cache = record.revisions.slice(
    0,
    initial_cache_size
  );
  const revision_cache: RevisionCache = (await getRevisions(
    project_id,
    revision_ids_to_seed_cache
  )) as RevisionCache;
  const working_heads = record.heads.concat(); // make a clean copy
  const initial_head_revisions = await getRevisions(project_id, working_heads);
  for (const rev_id in working_heads) {
    revision_cache[rev_id] = initial_head_revisions[rev_id];
  }

  // we've now set up our environment to start doing pairwise merging of the
  // heads
  while (working_heads.length > 1) {
    let us_id = working_heads.shift();
    if (us_id === undefined) {
      // we've emptied working_heads, no more merging
      break;
    }
    console.debug(`merging ${us_id}`);
    const to_merge_heads = working_heads.concat();
    for (const them_index in to_merge_heads) {
      const pairwise_merge_result: MergeResult = await do3WayMerge(
        project_id,
        revision_cache,
        to_merge_heads[them_index],
        us_id
      );
      if (pairwise_merge_result.is_successful()) {
        working_heads.splice(Number(them_index), 1);
        us_id = pairwise_merge_result.get_new_revision_id() as RevisionID;
        console.debug(`merged ${to_merge_heads[them_index]} as ${us_id}`);
      } else {
        fully_merged = false;
      }
    }
  }

  if (fully_merged === undefined) {
    fully_merged = true;
  }
  return fully_merged;
}
