/*
 * templates.ts
 * This module handles fetching templates from the server..
 */

import {GetListTemplatesResponse} from '@faims3/data-model';
import {getTokenForCluster} from '../../../users';
import {ListingsObject} from '../../../sync/databases';

/**
 * Fetch the list of templates from the server.
 * @param listing - Information about the server listing.
 * @returns An array of templates if successful, or undefined if there is an error.
 */
export const fetchTemplates = async (
  listing: ListingsObject
): Promise<GetListTemplatesResponse | undefined> => {
  try {
    const jwt_token = await getTokenForCluster(listing._id);

    if (!jwt_token) {
      console.error('No token available for this cluster.');
      return undefined;
    }

    const response = await fetch(`${listing.conductor_url}/api/templates`, {
      headers: {
        Authorization: `Bearer ${jwt_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch templates:', response.statusText);
      return undefined;
    }

    // Parse and return the response data
    const data: GetListTemplatesResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching templates:', error);
    return undefined;
  }
};
