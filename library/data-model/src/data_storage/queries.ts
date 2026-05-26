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
 * Filename: queries.ts
 * Description:
 *   Functions to query specific information from pouchdb
 */
import {getDataDB} from '../callbacks';
import {
  AttributeValuePair,
  DataDbType,
  FAIMSTypeName,
  ProjectID,
  ProjectUIModel,
  RecordID,
  RecordMetadata,
  RecordReference,
} from '../types';
import {listRecordMetadata} from './internals';

// Get all records of a specific type
// only referenced in a catch clause in storageFunctions.ts so probably never
// used
export async function getAllRecordsOfType(
  project_id: ProjectID,
  type: FAIMSTypeName
): Promise<RecordReference[]> {
  const dataDB = await getDataDB(project_id);

  const BATCH_SIZE = 100;
  const records: RecordReference[] = [];
  let skip = 0;
  let res;
  let count = 0;

  do {
    res = await dataDB.find({
      selector: {
        record_format_version: 1,
        type: type,
      },
      limit: BATCH_SIZE,
      skip: skip,
    });

    count = res.docs.length;
    // const hrid = (await getHRID(project_id, o.revision)) ;
    res.docs.forEach((o: any) => {
      records.push({
        project_id: project_id,
        record_id: o._id,
        record_label: o._id, // TODO: decide how we're getting HRIDs from db
      });
    });

    skip += BATCH_SIZE;
  } while (res && count === BATCH_SIZE);

  return records;
}

/**
 * Get an array of records with values that match a regular expression
 * @param projectId - Project Id
 * @param regex - regular expression matching data values
 * @param hydrate - should the data/hrid fields be populated?
 * @returns an array of record objects
 */
export async function getAllRecordsWithRegex({
  projectId,
  regex,
  uiSpecification,
  dataDb,
  hydrate = true,
}: {
  projectId: ProjectID;
  regex: string;
  uiSpecification: ProjectUIModel;
  dataDb: DataDbType;
  hydrate?: boolean;
}): Promise<RecordMetadata[]> {
  // find avp documents with matching data, get the record ids from them

  const BATCH_SIZE = 100;
  let skip = 0;
  let res;
  let count = 0;
  const record_ids = [] as RecordID[];

  // need to query in batches since find requires a limit argument
  do {
    res = await dataDb.find({
      selector: {
        avp_format_version: 1,
        // need an or query here to handle values that are arrays
        $or: [{data: {$regex: regex}}, {data: {$elemMatch: {$regex: regex}}}],
      },
      limit: BATCH_SIZE,
      skip: skip,
    });

    count = res.docs.length;
    res.docs.forEach((o: any) => {
      const avp = o as AttributeValuePair;
      record_ids.push(avp.record_id);
    });
    skip += BATCH_SIZE;
  } while (res && count === BATCH_SIZE);

  // Remove duplicates, no order is implied
  const deduped_record_ids = Array.from(new Set<RecordID>(record_ids));
  return await listRecordMetadata({
    dataDb,
    projectId: projectId,
    recordIds: deduped_record_ids,
    uiSpecification,
    hydrate,
  });
}
