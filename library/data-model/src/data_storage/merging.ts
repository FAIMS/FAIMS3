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

import {getDataDB} from '../callbacks';
import {
  AttributeValuePairIDMap,
  DataDbType,
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
  getRevision,
  getRevisions,
  getAttributeValuePairs,
  updateHeads,
  getRecord,
  mergeRecordConflicts,
  buildDocumentMap,
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

async function getCachedRevision({
  dataDb,
  revisionCache,
  revisionId,
}: {
  dataDb: DataDbType;
  revisionCache: RevisionCache;
  revisionId: RevisionID;
}): Promise<Revision> {
  let revision = revisionCache[revisionId];
  if (revision === undefined) {
    revision = await getRevision({dataDb, revisionId});
    revisionCache[revisionId] = revision;
  }
  return revision;
}

async function getBaseRevision({
  revisionCache,
  us,
  them,
  dataDb,
}: {
  dataDb: DataDbType;
  projectId: ProjectID;
  revisionCache: RevisionCache;
  them: Revision;
  us: Revision;
}): Promise<Revision> {
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
    for (const parentId of current_revision.parents) {
      const parent = await getCachedRevision({
        dataDb,
        revisionCache,
        revisionId: parentId,
      });
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

async function doFastForward({
  mergeResult,
  base,
  them,
  us,
  dataDb,
}: {
  mergeResult: MergeResult;
  base: Revision;
  them: Revision;
  us: Revision;
  dataDb: DataDbType;
}): Promise<MergeResult> {
  if (base._id === them._id) {
    mergeResult.set_fast_forward(us._id);
    await updateHeads({
      dataDb,
      recordId: us.record_id,
      baseRevisionId: [them._id, base._id],
      newRevisionId: us._id,
    });
  }
  if (base._id === us._id) {
    mergeResult.set_fast_forward(them._id);
    await updateHeads({
      dataDb,
      recordId: them.record_id,
      baseRevisionId: [us._id, base._id],
      newRevisionId: them._id,
    });
  }
  return mergeResult;
}

async function do3WayMerge({
  dataDb,
  revisionCache,
  themId,
  usId,
  projectId,
}: {
  projectId: string;
  dataDb: DataDbType;
  revisionCache: RevisionCache;
  themId: RevisionID;
  usId: RevisionID;
}): Promise<MergeResult> {
  console.debug(`merging ${usId} and ${themId}`);
  const avp_map: AttributeValuePairIDMap = {};
  const mergeResult = new MergeResult();
  const them = await getCachedRevision({
    dataDb,
    revisionCache: revisionCache,
    revisionId: themId,
  });
  const us = await getCachedRevision({dataDb, revisionCache, revisionId: usId});
  const base = await getBaseRevision({
    dataDb,
    revisionCache,
    them,
    projectId,
    us,
  });
  console.debug('Base revision:', base);
  if (canFastForward(base, them, us)) {
    return await doFastForward({dataDb, mergeResult, base, them, us});
  }

  if (them.type !== us.type) {
    // Because changing types it unsupported:
    throw Error('Merging of revisions with differing types is unsupported');
  }

  const them_deleted = them.deleted ?? false;
  const us_deleted = us.deleted ?? false;
  if (them_deleted !== us_deleted) {
    mergeResult.set_no_merge();
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
      mergeResult.set_no_merge();
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
      mergeResult.set_no_merge();
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
      mergeResult.set_trivial();
    } else {
      // We're going to need to do a merge
      if (their_avp_id === base_avp_id) {
        // We're the ones with the change
        avp_map[attr] = our_avp_id;
        mergeResult.set_merge_us();
      } else if (our_avp_id === base_avp_id) {
        // They're the ones with the change
        avp_map[attr] = their_avp_id;
        mergeResult.set_merge_them();
      } else {
        // Both us and them have changed the field, we can't automerge
        mergeResult.set_no_merge();
      }
    }
  }

  if (mergeResult.is_successful()) {
    const new_revision_id = generateFAIMSRevisionID();
    const creation_time = new Date();
    const creator = await getAutomergeCreator(projectId);
    const parents = [usId, themId].sort();

    mergeResult.add_new_revision(new_revision_id);

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
    await dataDb.put(new_revision);
    await updateHeads({
      dataDb,
      recordId: us.record_id,
      baseRevisionId: parents,
      newRevisionId: new_revision_id,
    });
  }
  return mergeResult;
}

export async function mergeHeads({
  projectId,
  recordId,
  cacheSize = 100,
  dataDb,
}: {
  projectId: ProjectID;
  recordId: RecordID;
  cacheSize?: number;
  dataDb: DataDbType;
}): Promise<boolean> {
  let fully_merged: boolean | undefined = undefined;
  console.debug('Getting record', projectId, recordId);
  // Get the record and merge it
  const record = await getRecord({dataDb, recordId});
  if (!record) {
    throw new Error(
      `Cannot merge heads for non-existent record with ID ${recordId}`
    );
  }
  mergeRecordConflicts({dataDb, record});
  const revision_ids_to_seed_cache = record.revisions.slice(0, cacheSize);
  console.debug(
    'Getting initial revisions',
    projectId,
    recordId,
    revision_ids_to_seed_cache
  );
  const revision_cache: RevisionCache = buildDocumentMap({
    docs: await getRevisions({
      dataDb,
      revisionIds: revision_ids_to_seed_cache,
    }),
  }) as RevisionCache;
  const working_heads = record.heads.concat(); // make a clean copy
  console.debug('Getting initial head revisions', projectId, recordId);

  const initial_head_revisions = buildDocumentMap({
    docs: await getRevisions({dataDb, revisionIds: working_heads}),
  });
  for (const rev_id in working_heads) {
    revision_cache[rev_id] = initial_head_revisions[rev_id];
  }

  // we've now set up our environment to start doing pairwise merging of the
  // heads
  console.debug('Starting merge', projectId, recordId);
  while (working_heads.length > 1) {
    let us_id = working_heads.shift();
    if (us_id === undefined) {
      // we've emptied working_heads, no more merging
      break;
    }
    console.debug(`merging ${us_id}`);

    const to_merge_heads = working_heads.concat();
    for (const them_index in to_merge_heads) {
      const pairwise_merge_result: MergeResult = await do3WayMerge({
        dataDb,
        projectId,
        revisionCache: revision_cache,
        usId: us_id,
        themId: to_merge_heads[them_index],
      });
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
  console.debug('Finished merge', projectId, recordId);
  return fully_merged;
}

async function getMergeInformationForRevision({
  projectId,
  revision,
  dataDb,
}: {
  projectId: ProjectID;
  revision: Revision;
  dataDb: DataDbType;
}): Promise<RecordMergeInformation> {
  const avp_ids = Object.values(revision.avps);
  const avps = await getAttributeValuePairs({avpIds: avp_ids, dataDb});

  const record_info: RecordMergeInformation = {
    project_id: projectId,
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

async function findInitialMergeDetails({
  projectId,
  revisions,
  dataDb,
}: {
  projectId: ProjectID;
  revisions: RevisionMap;
  dataDb: DataDbType;
}): Promise<InitialMergeHeadDetails | null> {
  for (const rev_id in revisions) {
    try {
      const full_record = await getMergeInformationForRevision({
        dataDb,
        projectId,
        revision: revisions[rev_id],
      });
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

export async function getInitialMergeDetails({
  recordId,
  projectId,
  dataDb,
}: {
  projectId: ProjectID;
  recordId: RecordID;
  dataDb: DataDbType;
}): Promise<InitialMergeDetails | null> {
  const record = await getRecord({dataDb, recordId});
  if (!record) {
    throw new Error(`Cannot get merge details for missing record ${recordId}`);
  }
  const available_revisions = buildDocumentMap({
    docs: await getRevisions({
      dataDb,
      revisionIds: record.heads,
    }),
  });
  const initial_head_details = await findInitialMergeDetails({
    dataDb,
    projectId,
    revisions: available_revisions,
  });
  if (initial_head_details === null) {
    return null;
  }
  return {
    initial_head: initial_head_details.initial_head,
    initial_head_data: initial_head_details.initial_head_data,
    available_heads: getInitialMergeRevisionDetails(available_revisions),
  };
}

export async function findConflictingFields({
  projectId,
  recordId,
  revisionId,
  dataDb,
}: {
  projectId: ProjectID;
  recordId: RecordID;
  revisionId: RevisionID;
  dataDb: DataDbType;
}): Promise<string[]> {
  const record = await getRecord({dataDb, recordId});
  if (!record) {
    throw new Error(
      `Cannot get conflicting fields for missing record ${recordId}`
    );
  }

  const conflicting_fields: Set<string> = new Set();

  let revs_to_get: RevisionID[];
  if (record.heads.includes(revisionId)) {
    revs_to_get = record.heads;
  } else {
    revs_to_get = [revisionId, ...record.heads];
    logError(
      `Not using a head to find conflicting fields: ${projectId}, ${recordId}, ${revisionId}`
    );
  }

  const revisions = buildDocumentMap({
    docs: await getRevisions({dataDb, revisionIds: revs_to_get}),
  });

  const initial_revision = revisions[revisionId];

  for (const revision_id_to_compare of record.heads) {
    if (revision_id_to_compare === revisionId) {
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

export async function getMergeInformationForHead({
  projectId,
  recordId,
  revisionId,
  dataDb,
}: {
  projectId: ProjectID;
  recordId: RecordID;
  revisionId: RevisionID;
  dataDb: DataDbType;
}): Promise<RecordMergeInformation | null> {
  try {
    const record = await getRecord({dataDb, recordId});
    if (!record) {
      throw new Error(
        `Cannot get merge information for missing record ${recordId}`
      );
    }
    if (!record.heads.includes(revisionId)) {
      logError(
        `Not using a head to find conflicting fields: ${projectId}, ${recordId}, ${revisionId}`
      );
    }
    const revision = await getRevision({dataDb, revisionId});
    return await getMergeInformationForRevision({projectId, dataDb, revision});
  } catch (err) {
    logError(`Failed to get merge information for ${projectId} ${revisionId}`);
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

  await updateHeads({
    dataDb: dataDB,
    recordId: record_id,
    baseRevisionId: parents,
    newRevisionId: revision_id,
  });

  return true;
}
