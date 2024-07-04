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
 * Filename: merging.ts
 * Description:
 *   Merging logic and helpers. There is a single function `mergeHeads` which
 *   performs the automerge on a single record. The remaining exports are for
 *   merging by humans.
 */

import {getDataDB} from '../index';

import {
  AttributeValuePairIDMap,
  FAIMSTypeName,
  InitialMergeDetails,
  InitialMergeRevisionDetailsMap,
  LinkedRelation,
  ProjectID,
  RecordID,
  RecordMergeInformation,
  Revision,
  RevisionID,
  RevisionMap,
  UserMergeResult,
} from '../types';
import {
  generateFAIMSRevisionID,
  generateFAIMSAttributeValuePairID,
  getRecord,
  getRevision,
  getRevisions,
  getAttributeValuePairs,
  updateHeads,
} from './internals';
import {logError} from '../logging';

interface InitialMergeHeadDetails {
  initial_head: RevisionID;
  initial_head_data: RecordMergeInformation;
}

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

async function do3WayMerge(
  project_id: ProjectID,
  revision_cache: RevisionCache,
  them_id: RevisionID,
  us_id: RevisionID
): Promise<MergeResult> {
  console.debug(`merging ${us_id} and ${them_id}`);
  const dataDB = await getDataDB(project_id);
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

  const them_deleted = them.deleted ?? false;
  const us_deleted = us.deleted ?? false;
  if (them_deleted !== us_deleted) {
    merge_result.set_no_merge();
  }

  let parent: LinkedRelation | undefined = undefined;
  const them_parent = them.relationship?.parent ?? undefined;
  const us_parent = us.relationship?.parent ?? undefined;
  const base_parent = base.relationship?.parent ?? undefined;
  if (them_parent !== us_parent) {
    if (them_parent === base_parent) {
      parent = us_parent;
    } else if (us_parent === base_parent) {
      parent = them_parent;
    } else {
      merge_result.set_no_merge();
    }
  } else {
    parent = us_parent;
  }

  let linked: LinkedRelation[] | undefined = undefined;
  const them_linked = them.relationship?.linked ?? undefined;
  const us_linked = us.relationship?.linked ?? undefined;
  const base_linked = base.relationship?.linked ?? undefined;
  if (them_linked !== us_linked) {
    if (them_linked === base_linked) {
      linked = us_linked;
    } else if (us_linked === base_linked) {
      linked = them_linked;
    } else {
      merge_result.set_no_merge();
    }
  } else {
    linked = us_linked;
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
    console.debug('base, theirs, ours', base_avp_id, their_avp_id, our_avp_id);
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
      relationship: {
        parent: parent,
        linked: linked,
      },
    };
    await dataDB.put(new_revision);
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
  console.debug('Getting record', project_id, record_id);
  const record = await getRecord(project_id, record_id, true);
  const revision_ids_to_seed_cache = record.revisions.slice(
    0,
    initial_cache_size
  );
  console.debug(
    'Getting initial revisions',
    project_id,
    record_id,
    revision_ids_to_seed_cache
  );
  const revision_cache: RevisionCache = (await getRevisions(
    project_id,
    revision_ids_to_seed_cache
  )) as RevisionCache;
  const working_heads = record.heads.concat(); // make a clean copy
  console.debug('Getting initial head revisions', project_id, record_id);

  const initial_head_revisions = await getRevisions(project_id, working_heads);
  for (const rev_id in working_heads) {
    revision_cache[rev_id] = initial_head_revisions[rev_id];
  }

  // we've now set up our environment to start doing pairwise merging of the
  // heads
  console.debug('Starting merge', project_id, record_id);
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
  console.debug('Finished merge', project_id, record_id);
  return fully_merged;
}

// TODO: Work out preferred sort order
function sortRevisionsForInitialMerge(revisions: RevisionMap): RevisionMap {
  return revisions;
}

async function getMergeInformationForRevision(
  project_id: ProjectID,
  revision: Revision
): Promise<RecordMergeInformation> {
  const avp_ids = Object.values(revision.avps);
  const avps = await getAttributeValuePairs(project_id, avp_ids);

  const record_info: RecordMergeInformation = {
    project_id: project_id,
    record_id: revision.record_id,
    revision_id: revision._id,
    type: revision.type,
    updated: new Date(revision.created),
    updated_by: revision.created_by,
    fields: {},
    deleted: revision.deleted ?? false,
    relationship: revision.relationship ?? {}, //relationship?: Relationship;
  };

  for (const [name, avp_id] of Object.entries(revision.avps)) {
    record_info.fields[name] = {
      data: avps[avp_id].data,
      type: avps[avp_id].type,
      annotations: avps[avp_id].annotations,
      created: new Date(avps[avp_id].created),
      created_by: avps[avp_id].created_by,
      avp_id: avp_id,
    };
  }

  return record_info;
}

async function findInitialMergeDetails(
  project_id: ProjectID,
  record_id: RecordID,
  revisions: RevisionMap
): Promise<InitialMergeHeadDetails | null> {
  for (const rev_id in revisions) {
    try {
      const full_record = await getMergeInformationForRevision(
        project_id,
        revisions[rev_id]
      );
      return {
        initial_head: rev_id,
        initial_head_data: full_record,
      };
    } catch (err) {
      console.log('Error while looking up initial merge information', err);
      continue;
    }
  }
  // Unable to load any revisions
  return null;
}

function getInitialMergeRevisionDetails(
  revisions: RevisionMap
): InitialMergeRevisionDetailsMap {
  const rev_details_map: InitialMergeRevisionDetailsMap = {};
  for (const rev_id in revisions) {
    const revision = revisions[rev_id];
    rev_details_map[rev_id] = {
      type: revision.type,
      created: new Date(revision.created),
      created_by: revision.created_by,
      deleted: revision.deleted ?? false,
    };
  }
  return rev_details_map;
}

export async function getInitialMergeDetails(
  project_id: ProjectID,
  record_id: RecordID
): Promise<InitialMergeDetails | null> {
  const record = await getRecord(project_id, record_id);
  const available_revisions = await getRevisions(project_id, record.heads);
  const sorted_revisions = sortRevisionsForInitialMerge(available_revisions);
  const initial_head_details = await findInitialMergeDetails(
    project_id,
    record_id,
    sorted_revisions
  );
  if (initial_head_details === null) {
    return null;
  }
  return {
    initial_head: initial_head_details.initial_head,
    initial_head_data: initial_head_details.initial_head_data,
    available_heads: getInitialMergeRevisionDetails(sorted_revisions),
  };
}

export async function findConflictingFields(
  project_id: ProjectID,
  record_id: RecordID,
  revision_id: RevisionID
): Promise<string[]> {
  const record = await getRecord(project_id, record_id);
  const conflicting_fields: Set<string> = new Set();

  let revs_to_get: RevisionID[];
  if (record.heads.includes(revision_id)) {
    revs_to_get = record.heads;
  } else {
    revs_to_get = [revision_id, ...record.heads];
    logError(
      `Not using a head to find conflicting fields: ${project_id}, ${record_id}, ${revision_id}`
    );
  }

  const revisions = await getRevisions(project_id, revs_to_get);

  const initial_revision = revisions[revision_id];

  for (const revision_id_to_compare of record.heads) {
    if (revision_id_to_compare === revision_id) {
      continue;
    }
    const rev_to_compare = revisions[revision_id_to_compare];
    for (const [field_name, avp_id] of Object.entries(initial_revision.avps)) {
      if (avp_id !== rev_to_compare.avps[field_name]) {
        conflicting_fields.add(field_name);
      }
    }
  }

  return Array.from(conflicting_fields);
}

export async function getMergeInformationForHead(
  project_id: ProjectID,
  record_id: RecordID,
  revision_id: RevisionID
): Promise<RecordMergeInformation | null> {
  try {
    const record = await getRecord(project_id, record_id);
    if (!record.heads.includes(revision_id)) {
      logError(
        `Not using a head to find conflicting fields: ${project_id}, ${record_id}, ${revision_id}`
      );
    }
    const revision = await getRevision(project_id, revision_id);
    return await getMergeInformationForRevision(project_id, revision);
  } catch (err) {
    logError(
      `Failed to get merge information for ${project_id} ${revision_id}`
    );
    logError(err);
    return null;
  }
}

async function getAVPMapFromMergeResult(
  merge_result: UserMergeResult,
  new_revision_id: RevisionID
): Promise<AttributeValuePairIDMap> {
  const avp_map: AttributeValuePairIDMap = {};

  for (const [field_name, avp_id] of Object.entries(
    merge_result.field_choices
  )) {
    if (avp_id === null) {
      const dataDB = await getDataDB(merge_result.project_id);
      const new_avp_id = generateFAIMSAttributeValuePairID();
      const new_avp = {
        _id: new_avp_id,
        avp_format_version: 1,
        type: merge_result.field_types[field_name] ?? '??:??',
        data: null,
        revision_id: new_revision_id,
        record_id: merge_result.record_id,
        annotations: null,
        created: merge_result.updated.toISOString(),
        created_by: merge_result.updated_by,
      };
      await dataDB.put(new_avp);
      avp_map[field_name] = new_avp_id;
    } else {
      avp_map[field_name] = avp_id;
    }
  }

  return avp_map;
}

export async function saveUserMergeResult(merge_result: UserMergeResult) {
  const project_id = merge_result.project_id;
  const record_id = merge_result.record_id;
  const parents = merge_result.parents;
  const updated = merge_result.updated;
  const updated_by = merge_result.updated_by;
  const type = merge_result.type;

  const revision_id = generateFAIMSRevisionID();

  const dataDB = await getDataDB(project_id);
  const avp_map = await getAVPMapFromMergeResult(merge_result, revision_id);

  const new_revision: Revision = {
    _id: revision_id,
    revision_format_version: 1,
    avps: avp_map,
    record_id: record_id,
    parents: parents,
    created: updated.toISOString(),
    created_by: updated_by,
    deleted: false,
    type: type,
    relationship: merge_result.relationship,
  };
  await dataDB.put(new_revision);

  await updateHeads(project_id, record_id, parents, revision_id);

  return true;
}
