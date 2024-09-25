/*
 * This module is responsible for interacting with notebooks in the API.
 */

import {
  PostCreateNotebookInput,
  PostCreateNotebookResponse,
} from '@faims3/data-model';

import FetchManager from './client';

/**
 * Fetches the list of templates from the server for a specific cluster.
 *
 * @param listing - Contains server information, including the cluster's unique ID and conductor URL.
 * @returns A promise that resolves to an array of templates if the request is successful, or undefined if an error occurs.
 */
export const createNotebookFromTemplate = async (input: {
  listingId: string;
  templateId: string;
  name: string;
}): Promise<PostCreateNotebookResponse> => {
  // Create a new notebook
  return await FetchManager.post<PostCreateNotebookResponse>(
    input.listingId,
    '/api/notebooks',
    {template_id: input.templateId, name: input.name} as PostCreateNotebookInput
  );
};
