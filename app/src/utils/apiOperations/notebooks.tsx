/*
 * This module is responsible for interacting with notebooks in the API.
 */

import {
  getRecordListAudit,
  ProjectID,
  queryCouch,
  RECORDS_INDEX,
  PostCreateNotebookInput,
  PostCreateNotebookResponse,
  PostRecordStatusInput,
  PostRecordStatusResponse,
} from '@faims3/data-model';
import {localGetDataDb} from '../..';

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
 * Submit a record audit to the api for validation
 * @returns The record audit structure
 */
export const getRecordAudit = async ({
  projectId,
  listingId,
  username,
  audit,
}: {
  projectId: ProjectID;
  listingId: string;
  username: string;
  audit: Record<string, string>;
}): Promise<PostRecordStatusResponse> => {
  return await FetchManager.post<PostRecordStatusResponse>(
    listingId,
    username,
    `/api/notebooks/${projectId}/sync-status/`,
    {record_map: audit} as PostRecordStatusInput
  );
};
