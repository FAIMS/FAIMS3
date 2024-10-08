/*
 * templates.ts
 * This module is responsible for fetching available templates from the server.
 */

import {GetListTemplatesResponse} from '@faims3/data-model';
import FetchManager from './client';

/**
 * Fetches the list of templates from the server for a specific cluster.
 *
 * @param listing - Contains server information, including the cluster's unique ID and conductor URL.
 * @returns A promise that resolves to an array of templates if the request is successful, or undefined if an error occurs.
 */
export const fetchTemplates = async (
  listingId: string
): Promise<GetListTemplatesResponse> => {
  // Make a request to the server to fetch the templates
  return await FetchManager.get<GetListTemplatesResponse>(
    listingId,
    '/api/templates',
    {}
  );
};
