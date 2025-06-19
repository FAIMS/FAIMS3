/*
 * This module is responsible for interacting with notebooks in the API.
 */


import {
  getDataDB,
  getRecordListAudit,
  ProjectID,
  queryCouch,
  RECORDS_INDEX,
  PostCreateNotebookInput,
  PostCreateNotebookResponse,
  PostRecordStatusInput,
  PostRecordStatusResponse,
} from '@faims3/data-model';

import FetchManager from './client';

/**
 * Creates a new notebook from a given template ID.
 *
 * @param listing - Which listing to apply this operation to
 * @returns The response from notebook create op
 */
export const createNotebookFromTemplate = async (input: {
  listingId: string;
  username: string;
  templateId: string;
  name: string;
}): Promise<PostCreateNotebookResponse> => {
  // Create a new notebook
  return await FetchManager.post<PostCreateNotebookResponse>(
    input.listingId,
    input.username,
    '/api/notebooks',
    {template_id: input.templateId, name: input.name} as PostCreateNotebookInput
  );
};

export interface RecordStatus extends PostRecordStatusResponse {
  recordHashes: Record<string, string>;
}

/**
 * Validate the sync status of records in a project
 *
 * @param projectId - the project id to validate
 */
export const validateSyncStatus = async ({
  projectId,
  username,
  listingId,
  currentStatus,
}: {
  projectId: ProjectID;
  username: string;
  listingId: string;
  currentStatus: RecordStatus | undefined;
}): Promise<RecordStatus> => {
  // get the list of record ids from the project
  const dataDb = await getDataDB(projectId);

  // get a list of record ids from the project
  const records = await queryCouch({
    db: dataDb,
    index: RECORDS_INDEX,
  });
  const recordIds = records.map(r => r._id);
  const audit = await getRecordListAudit({recordIds, dataDb});
  let filteredAudit: Record<string, string>= {};

  // now filter any records that we know are good from the last
  // audit
  if (currentStatus) {
    for (const recordId of recordIds) {
      // check the record if the hash has changed or the status was false last time
      if (
        audit[recordId] !== currentStatus.recordHashes[recordId] ||
        !currentStatus.status[recordId]
      ) {
        filteredAudit[recordId] = audit[recordId];
      }
    }
  } else {
    filteredAudit = audit;
  }

  if (Object.getOwnPropertyNames(audit).length > 0) {
    const response = await FetchManager.post<PostRecordStatusResponse>(
      listingId,
      username,
      `/api/notebooks/${projectId}/sync-status/`,
      {record_map: filteredAudit} as PostRecordStatusInput
    );

    // we need to merge the returned value with the
    // current status
    const status = {
      ...response.status,
      ...currentStatus?.status,
    };
    return {
      status: status,
      recordHashes: audit,
    };
  } else if (currentStatus) {
    return currentStatus;
  } else {
    return {
      status: {},
      recordHashes: {},
    };
  }
};
