/*
 * This module is responsible for interacting with notebooks in the API.
 */

import {
  PostCreateNotebookInput,
  PostCreateNotebookResponse,
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
