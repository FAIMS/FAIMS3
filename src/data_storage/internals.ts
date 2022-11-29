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
 * Filename: internals.ts
 * Description:
 *   Helper functions to handle converting data between the GUI and pouchdb.
 */

import {v4 as uuidv4} from 'uuid';

import {DEBUG_APP} from '../buildconfig';
import {getDataDB} from '../sync';
import {
  AttributeValuePairID,
  RecordID,
  ProjectID,
  RevisionID,
  FAIMSTypeName,
  Annotations,
  HRID_STRING,
} from '../datamodel/core';
import {
  AttributeValuePair,
  AttributeValuePairMap,
  AttributeValuePairIDMap,
  EncodedRecord,
  FAIMSAttachment,
  RecordMap,
  Revision,
  RevisionMap,
} from '../datamodel/database';
import {Record, RecordMetadataList} from '../datamodel/ui';
import {
  getAttachmentLoaderForType,
  getAttachmentDumperForType,
  getEqualityFunctionForType,
} from '../datamodel/typesystem';

type EncodedRecordMap = Map<RecordID, EncodedRecord>;

interface FormData {
  data: {[field_name: string]: any};
  annotations: {[field_name: string]: Annotations};
  types: {[field_name: string]: FAIMSTypeName};
}

export function generateFAIMSRevisionID(): RevisionID {
  return 'frev-' + uuidv4();
}

export function generateFAIMSAttributeValuePairID(): AttributeValuePairID {
  return 'avp-' + uuidv4();
}

export async function updateHeads(
  project_id: ProjectID,
  obsid: RecordID,
  base_revids: RevisionID[],
  new_revid: RevisionID
) {
  const datadb = await getDataDB(project_id);
  const record = await getRecord(project_id, obsid);

  // Add new revision to heads, removing obsolete heads
  // Using set in case we have the revision already (i.e. we're cleaning up
  // heads via a fast-forward merge)
  const heads = new Set<RevisionID>(record.heads);
  heads.add(new_revid);
  for (const r of base_revids) {
    heads.delete(r);
  }
  record.heads = Array.from(heads);
  record.heads.sort();

  // Add new head to revisions also
  // Using set in case we have the revision already (i.e. we're cleaning up
  // heads via a fast-forward merge)
  const revisions = new Set<RevisionID>(record.revisions);
  revisions.add(new_revid);
  record.revisions = Array.from(revisions);
  record.revisions.sort();

  await datadb.put(record);
}

async function mergeRecordConflicts(
  project_id: ProjectID,
  record: EncodedRecord
): Promise<EncodedRecord> {
  const datadb = await getDataDB(project_id);

  // There is no merge functionality in couchdb, you pick a revision and delete
  // the others. Let's use the default revision selected as the base for
  // consistency.

  if (record._conflicts === undefined) {
    // If there are no actual conflicts, just return as per normal
    return record;
  }
  // Get current heads, revisions as sets for easy merging
  const heads = new Set<RevisionID>(record.heads);
  const revisions = new Set<RevisionID>(record.revisions);

  // Get the additional conflicted revisions
  const conflicted_docs = await datadb.get(record._id, {
    open_revs: record._conflicts,
  });
  const new_docs = [];
  for (const doc of conflicted_docs) {
    const tmp_rec = doc.ok as EncodedRecord;
    // Add heads
    for (const rev of tmp_rec.heads) {
      heads.add(rev);
    }
    // Add revisions
    for (const rev of tmp_rec.revisions) {
      revisions.add(rev);
    }
    // We will delete the additional revisions
    tmp_rec._deleted = true;
    new_docs.push(tmp_rec);
  }
  record.heads = Array.from(heads);
  record.heads.sort();
  record.revisions = Array.from(revisions);
  record.revisions.sort();
  new_docs.push(record);
  await datadb.bulkDocs(new_docs);
  return record;
}

export async function getRecord(
  project_id: ProjectID,
  obsid: RecordID,
  merge_conflicts = false
): Promise<EncodedRecord> {
  const records = await getRecords(project_id, [obsid]);
  const record = records[obsid];
  if (record === undefined) {
    throw Error(`no such record ${obsid}`);
  }
  if (merge_conflicts) {
    return await mergeRecordConflicts(project_id, record);
  }
  return record;
}

export async function getRevision(
  project_id: ProjectID,
  rev_id: RevisionID
): Promise<Revision> {
  const revisions = await getRevisions(project_id, [rev_id]);
  const revision = revisions[rev_id];
  if (revision === undefined) {
    throw Error(`no such revision ${rev_id}`);
  }
  return revision;
}

export async function getAttributeValuePair(
  project_id: ProjectID,
  avp_id: AttributeValuePairID
): Promise<AttributeValuePair> {
  const avps = await getAttributeValuePairs(project_id, [avp_id]);
  const avp = avps[avp_id];
  if (avp === undefined) {
    throw Error(`no such avp ${avp_id}`);
  }
  return avp;
}

export async function getLatestRevision(
  project_id: ProjectID,
  docid: string
): Promise<string | undefined> {
  const datadb = await getDataDB(project_id);
  try {
    const doc = await datadb.get(docid);
    return doc._rev;
  } catch (err) {
    if (DEBUG_APP) {
      console.debug(err);
    }
    return undefined;
  }
}

export async function getHRID(
  project_id: ProjectID,
  revision: Revision
): Promise<string | null> {
  let hrid_name: string | null = null;
  for (const possible_name of Object.keys(revision.avps)) {
    if (possible_name.startsWith(HRID_STRING)) {
      hrid_name = possible_name;
      break;
    }
  }

  if (DEBUG_APP) {
    console.debug('hrid_name:', hrid_name);
  }
  if (hrid_name === null) {
    console.warn('No HRID field found');
    return null;
  }
  const hrid_avp_id = revision.avps[hrid_name];
  if (hrid_avp_id === undefined) {
    console.warn('No HRID field set for revision');
    return null;
  }
  if (DEBUG_APP) {
    console.debug('hrid_avp_id:', hrid_avp_id);
  }
  try {
    const hrid_avp = await getAttributeValuePair(project_id, hrid_avp_id);
    if (DEBUG_APP) {
      console.debug('hrid_avp:', hrid_avp);
    }
    return hrid_avp.data as string;
  } catch (err) {
    console.warn('Failed to load HRID AVP:', project_id, hrid_avp_id);
    return null;
  }
}

/**
 * Returns a list of not deleted records
 * @param project_id Project ID to get list of record for
 * @returns key: record id, value: record (NOT NULL)
 */
export async function listRecordMetadata(
  project_id: ProjectID,
  record_ids: RecordID[] | null = null
): Promise<RecordMetadataList> {
  try {
    const out: RecordMetadataList = {};
    const records =
      record_ids === null
        ? await getAllRecords(project_id)
        : recordToRecordMap(await getRecords(project_id, record_ids));
    const revision_ids: RevisionID[] = [];
    records.forEach(o => {
      revision_ids.push(o.heads[0]);
    });
    if (revision_ids.length === 0) {
      // No records, so return early
      return out;
    }
    const revisions = await getRevisions(project_id, revision_ids);
    for (const [record_id, record] of records) {
      const revision_id = record.heads[0];
      const revision = revisions[revision_id];
      if (revision === undefined) {
        // We don't have that revision, so skip
        console.warn(
          'Unable to find revision',
          project_id,
          record_id,
          revision_id
        );
        continue;
      }
      const hrid =
        revision === undefined
          ? record_id
          : (await getHRID(project_id, revision)) ?? record_id;
      if (DEBUG_APP) {
        console.debug('hrid:', hrid);
      }
      out[record_id] = {
        project_id: project_id,
        record_id: record_id,
        revision_id: revision_id,
        created: new Date(record.created),
        created_by: record.created_by,
        updated: new Date(revision.created),
        updated_by: revision.created_by,
        conflicts: record.heads.length > 1,
        deleted: revision.deleted ? true : false,
        hrid: hrid,
        type: record.type,
        relationship: revision.relationship,
      };
    }
    if (DEBUG_APP) {
      console.debug('Record metadata list', out);
    }
    return out;
  } catch (err) {
    console.warn('Failed to get metadata', err);
    throw Error('failed to get metadata');
  }
}

export async function getAttributeValuePairs(
  project_id: ProjectID,
  avp_ids: AttributeValuePairID[]
): Promise<AttributeValuePairMap> {
  const datadb = await getDataDB(project_id);
  const res = await datadb.allDocs({
    include_docs: true,
    attachments: true,
    binary: true,
    keys: avp_ids,
  });
  const rows = res.rows;
  const mapping: AttributeValuePairMap = {};
  for (const e of rows) {
    if (e.doc !== undefined) {
      const doc = e.doc as AttributeValuePair;
      mapping[doc._id] = await loadAttributeValuePair(project_id, doc);
    }
  }
  return mapping;
}

export async function getRevisions(
  project_id: ProjectID,
  revision_ids: RevisionID[]
): Promise<RevisionMap> {
  const datadb = await getDataDB(project_id);
  const res = await datadb.allDocs({
    include_docs: true,
    keys: revision_ids,
  });
  const rows = res.rows;
  const mapping: RevisionMap = {};
  rows.forEach(e => {
    if (e.doc !== undefined) {
      const doc = e.doc as Revision;
      mapping[doc._id] = doc;
    }
  });
  return mapping;
}

export async function getRecords(
  project_id: ProjectID,
  record_ids: RecordID[]
): Promise<RecordMap> {
  const datadb = await getDataDB(project_id);
  const res = await datadb.allDocs({
    include_docs: true,
    keys: record_ids,
    conflicts: true,
  });
  const rows = res.rows;
  const mapping: RecordMap = {};
  rows.forEach(e => {
    if (e.doc !== undefined) {
      const doc = e.doc as EncodedRecord;
      mapping[doc._id] = doc;
    }
  });
  return mapping;
}

function recordToRecordMap(old_recs: RecordMap): EncodedRecordMap {
  const records: EncodedRecordMap = new Map();
  for (const r in old_recs) {
    records.set(r, old_recs[r]);
  }
  return records;
}

export async function getAllRecords(
  project_id: ProjectID
): Promise<EncodedRecordMap> {
  const datadb = await getDataDB(project_id);
  const res = await datadb.find({
    selector: {
      record_format_version: 1,
    },
  });
  const records: EncodedRecordMap = new Map();
  res.docs.map(o => {
    records.set(o._id, o as EncodedRecord);
  });
  return records;
}

export async function getFormDataFromRevision(
  project_id: ProjectID,
  revision: Revision
): Promise<FormData> {
  const form_data: FormData = {
    data: {},
    annotations: {},
    types: {},
  };
  const avp_ids = Object.values(revision.avps);
  const avps = await getAttributeValuePairs(project_id, avp_ids);

  for (const [name, avp_id] of Object.entries(revision.avps)) {
    form_data.data[name] = avps[avp_id].data;
    form_data.annotations[name] = avps[avp_id].annotations;
    form_data.types[name] = avps[avp_id].type;
  }
  return form_data;
}

export async function addNewRevisionFromForm(
  project_id: ProjectID,
  record: Record,
  new_revision_id: RevisionID
) {
  const datadb = await getDataDB(project_id);
  const avp_map = await addNewAttributeValuePairs(
    project_id,
    record,
    new_revision_id
  );
  const parents = record.revision_id === null ? [] : [record.revision_id];
  const new_revision: Revision = {
    _id: new_revision_id,
    revision_format_version: 1,
    avps: avp_map,
    record_id: record.record_id,
    parents: parents,
    created: record.updated.toISOString(),
    created_by: record.updated_by,
    type: record.type,
    ugc_comment: record.ugc_comment,
    relationship: record.relationship,
  };
  await datadb.put(new_revision);
}

async function addNewAttributeValuePairs(
  project_id: ProjectID,
  record: Record,
  new_revision_id: RevisionID
): Promise<AttributeValuePairIDMap> {
  const datadb = await getDataDB(project_id);
  const avp_map: AttributeValuePairIDMap = {};
  let revision;
  let data;
  if (record.revision_id !== null) {
    revision = await getRevision(project_id, record.revision_id);
    data = await getFormDataFromRevision(project_id, revision);
  } else {
    revision = {};
    data = {
      data: {},
      annotations: {},
      types: {},
    };
  }
  const docs_to_dump: Array<AttributeValuePair | FAIMSAttachment> = [];
  for (const [field_name, field_value] of Object.entries(record.data)) {
    const stored_data = data.data[field_name];
    const stored_anno = data.annotations[field_name];
    const eqfunc = getEqualityFunctionForType(record.field_types[field_name]);
    const has_data_changed =
      stored_data === undefined || !(await eqfunc(stored_data, field_value));
    const has_anno_changed =
      stored_anno === undefined ||
      !(await eqfunc(stored_anno, record.annotations[field_name]));
    if (has_data_changed || has_anno_changed) {
      const new_avp_id = generateFAIMSAttributeValuePairID();
      const new_avp = {
        _id: new_avp_id,
        avp_format_version: 1,
        type: record.field_types[field_name] ?? '??:??',
        data: field_value,
        revision_id: new_revision_id,
        record_id: record.record_id,
        annotations: record.annotations[field_name],
        created: record.updated.toISOString(),
        created_by: record.updated_by,
      };
      docs_to_dump.push(...dumpAttributeValuePair(new_avp));
      avp_map[field_name] = new_avp_id;
    } else {
      if (DEBUG_APP) {
        console.info(
          'Using existing AVP, the following are equal',
          stored_data,
          field_value
        );
      }
      if (revision.avps !== undefined) {
        avp_map[field_name] = revision.avps[field_name];
      } else {
        // This should not happen, as if stored_data === field_value and
        // stored_data is not undefined, then then revision.avps should be
        // defined
        throw Error('something odd happened when saving avps...');
      }
    }
  }
  await datadb.bulkDocs(docs_to_dump);
  return avp_map;
}

export async function createNewRecord(
  project_id: ProjectID,
  record: Record,
  revision_id: RevisionID
) {
  const datadb = await getDataDB(project_id);
  const new_encoded_record = {
    _id: record.record_id,
    record_format_version: 1,
    created: record.updated.toISOString(),
    created_by: record.updated_by,
    revisions: [revision_id],
    heads: [revision_id],
    type: record.type,
  };
  try {
    await datadb.put(new_encoded_record);
  } catch (err) {
    // TODO: add proper error handling for conflicts
    console.warn(err);
    throw Error('failed to create record document');
  }
}

/*
 * This handles converting attachments to data
 */
async function loadAttributeValuePair(
  project_id: ProjectID,
  avp: AttributeValuePair
): Promise<AttributeValuePair> {
  const attach_refs = avp.faims_attachments;
  if (attach_refs === null || attach_refs === undefined) {
    // No attachments
    return avp;
  }
  const loader = getAttachmentLoaderForType(avp.type);
  if (loader === null) {
    return avp;
  }
  const ids_to_get = attach_refs.map(ref => ref.attachment_id);
  const datadb = await getDataDB(project_id);
  const res = await datadb.allDocs({
    include_docs: true,
    attachments: true,
    binary: true,
    keys: ids_to_get,
  });
  const rows = res.rows;
  const attach_docs: FAIMSAttachment[] = [];
  rows.forEach(e => {
    if (e.doc !== undefined) {
      const doc = e.doc as FAIMSAttachment;
      attach_docs.push(doc);
    }
  });
  return loader(avp, attach_docs);
}

/*
 * This handles converting data to attachments
 */
function dumpAttributeValuePair(
  avp: AttributeValuePair
): Array<AttributeValuePair | FAIMSAttachment> {
  const dumper = getAttachmentDumperForType(avp.type);
  if (dumper === null) {
    return [avp];
  }
  return dumper(avp);
}
