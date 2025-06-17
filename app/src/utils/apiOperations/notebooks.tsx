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

/**
 * Validate the sync status of records in a project
 *
 * @param projectId - the project id to validate
 */
export const validateSyncStatus = async ({
  projectId,
  username,
  listingId,
}: {
  projectId: ProjectID;
  username: string;
  listingId: string;
}): Promise<PostRecordStatusResponse> => {
  // get the list of record ids from the project
  const dataDb = await getDataDB(projectId);

  // get a list of record ids from the project
  const records = await queryCouch({
    db: dataDb,
    index: RECORDS_INDEX,
  });
  const recordIds = records.map(r => r._id);
  const audit = await getRecordListAudit({recordIds, dataDb});

  console.log('fetched audit');
  const response = await FetchManager.post<PostRecordStatusResponse>(
    listingId,
    username,
    `/api/notebooks/${projectId}/sync-status/`,
    {record_map: audit} as PostRecordStatusInput
  );
  return response;
};
