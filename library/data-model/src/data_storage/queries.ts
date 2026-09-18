// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: queries.ts
 * Description:
 *   Functions to query specific information from pouchdb
 */

import {
  AttributeValuePair,
  DataDbType,
  ProjectID,
  RecordID,
  RecordMetadata,
} from '../types';
import {UiSpecModel} from '../uiSpecification/types';
import {listRecordMetadata} from './internals';

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
  uiSpecification: UiSpecModel;
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
