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
import {getDataDB} from '../index';
import {
  ProjectID,
  FAIMSTypeName,
  RecordReference,
  RecordMetadataList,
  AttributeValuePair,
  RecordID,
} from '../types';

import {listRecordMetadata} from './internals';

export async function getAllRecordsOfType(
  project_id: ProjectID,
  type: FAIMSTypeName
): Promise<RecordReference[]> {
  const dataDB = await getDataDB(project_id);
  const res = await dataDB.find({
    selector: {
      record_format_version: 1,
      type: type,
    },
  });
  // const hrid = (await getHRID(project_id, o.revision)) ;
  return res.docs.map((o: any) => {
    return {
      project_id: project_id,
      record_id: o._id,
      record_label: o._id, // TODO: decide how we're getting HRIDs from db
    };
  });
}

/**
 * Get an array of records with values that match a regular expression
 * @param project_id - Project Id
 * @param regex - regular expression matching data values
 * @returns an array of record objects
 */
export async function getAllRecordsWithRegex(
  project_id: ProjectID,
  regex: string
): Promise<RecordMetadataList> {
  const dataDB = await getDataDB(project_id);
  // find avp documents with matching data, get the record ids from them
  const res = await dataDB.find({
    selector: {
      avp_format_version: 1,
      data: {$regex: regex},
    },
  });
  const record_ids = res.docs.map((o: any) => {
    const avp = o as AttributeValuePair;
    return avp.record_id;
  });
  // Remove duplicates, no order is implied
  const deduped_record_ids = Array.from(new Set<RecordID>(record_ids));
  return await listRecordMetadata(project_id, deduped_record_ids);
}
