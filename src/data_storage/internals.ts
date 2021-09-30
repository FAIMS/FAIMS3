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
 * Filename: internals.ts
 * Description:
 *   TODO
 */

import {v4 as uuidv4} from 'uuid';

import {getDataDB} from '../sync';
import {
  AttributeValuePairID,
  RecordID,
  ProjectID,
  RevisionID,
  FAIMSTypeName,
  Annotations,
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
import {Record, RecordMetadataList} from '../datamodel/ui';
import {
  getAttachmentLoaderForType,
  getAttachmentDumperForType,
} from '../datamodel/typesystem';

type EncodedRecordMap = Map<RecordID, EncodedRecord>;

interface FormData {
  data: {[field_name: string]: any};
  annotations: {[field_name: string]: Annotations};
  types: {[field_name: string]: FAIMSTypeName};
}

export function generateFAIMSRevisionID(): RevisionID {
  return uuidv4();
}

function generateFAIMSAttributeValuePairID(): AttributeValuePairID {
  return uuidv4();
}

export async function updateHeads(
  project_id: ProjectID,
  obsid: RecordID,
  base_revids: RevisionID[],
  new_revid: RevisionID
) {
  const datadb = getDataDB(project_id);
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

  datadb.put(record);
}

export async function getRecord(
  project_id: ProjectID,
  obsid: RecordID
): Promise<EncodedRecord> {
  const records = await getRecords(project_id, [obsid]);
  const record = records[obsid];
  if (record === undefined) {
    throw Error(`no such record ${obsid}`);
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
  const datadb = getDataDB(project_id);
  try {
    const doc = await datadb.get(docid);
    return doc._rev;
  } catch (err) {
    console.debug(err);
    return undefined;
  }
}

/**
 * Returns a list of not deleted records
 * @param project_id Project ID to get list of record for
 * @returns key: record id, value: record (NOT NULL)
 */
export async function listRecordMetadata(
  project_id: ProjectID
): Promise<RecordMetadataList> {
  try {
    const records = await getAllRecords(project_id);
    const revision_ids: RevisionID[] = [];
    records.forEach(o => {
      revision_ids.push(o.heads[0]);
    });
    const revisions = await getRevisions(project_id, revision_ids);

    const out: RecordMetadataList = {};
    records.forEach((record, record_id) => {
      const revision_id = record.heads[0];
      const revision = revisions[revision_id];
      out[record_id] = {
        project_id: project_id,
        record_id: record_id,
        revision_id: revision_id,
        created: new Date(record.created),
        created_by: record.created_by,
        updated: new Date(revision.created),
        updated_by: revision.created_by,
        conflicts: record.heads.length > 1,
      };
    });
    return out;
  } catch (err) {
    console.warn(err);
    throw Error('failed to get metadata');
  }
}

export async function getAttributeValuePairs(
  project_id: ProjectID,
  avp_ids: AttributeValuePairID[]
): Promise<AttributeValuePairMap> {
  const datadb = getDataDB(project_id);
  const res = await datadb.allDocs({
    include_docs: true,
    binary: true, // TODO: work out which format is best for attachments
    keys: avp_ids,
  });
  const rows = res.rows;
  const mapping: AttributeValuePairMap = {};
  rows.forEach(e => {
    if (e.doc !== undefined) {
      const doc = e.doc as AttributeValuePair;
      mapping[doc._id] = loadAttributeValuePair(doc);
    }
  });
  return mapping;
}

export async function getRevisions(
  project_id: ProjectID,
  revision_ids: RevisionID[]
): Promise<RevisionMap> {
  const datadb = getDataDB(project_id);
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
  const datadb = getDataDB(project_id);
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

export async function getAllRecords(
  project_id: ProjectID
): Promise<EncodedRecordMap> {
  const datadb = getDataDB(project_id);
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
  const datadb = getDataDB(project_id);
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
  };
  await datadb.put(new_revision);
}

async function addNewAttributeValuePairs(
  project_id: ProjectID,
  record: Record,
  new_revision_id: RevisionID
): Promise<AttributeValuePairIDMap> {
  const datadb = getDataDB(project_id);
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
  for (const [field_name, field_value] of Object.entries(record.data)) {
    const stored_data = data.data[field_name];
    if (stored_data === undefined || stored_data !== field_value) {
      const new_avp_id = generateFAIMSAttributeValuePairID();
      const new_avp = {
        _id: new_avp_id,
        avp_format_version: 1,
        type: record.field_types[field_name] ?? '??:??',
        data: field_value,
        revision_id: new_revision_id,
        record_id: record.record_id,
        annotations: record.annotations[field_name],
      };
      await datadb.put(dumpAttributeValuePair(new_avp));
      avp_map[field_name] = new_avp_id;
    } else {
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
  return avp_map;
}

export async function createNewRecord(
  project_id: ProjectID,
  record: Record,
  revision_id: RevisionID
) {
  const datadb = getDataDB(project_id);
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
function loadAttributeValuePair(avp: AttributeValuePair): AttributeValuePair {
  const attachments = avp._attachments;
  if (attachments === null || attachments === undefined) {
    // No attachments
    return avp;
  }
  const loader = getAttachmentLoaderForType(avp.type);
  if (loader === null) {
    return avp;
  }
  return loader(avp);
}

/*
 * This handles converting data to attachments
 */
function dumpAttributeValuePair(avp: AttributeValuePair): AttributeValuePair {
  const dumper = getAttachmentDumperForType(avp.type);
  if (dumper === null) {
    return avp;
  }
  return dumper(avp);
}
