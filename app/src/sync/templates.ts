/*
 * templates.ts
 * This module is responsible for fetching available templates from the server.
 */

import {GetListTemplatesResponse} from '@faims3/data-model';
import {getTokenForCluster} from '../users';
import {ListingsObject} from './databases';

/**
 * Fetches the list of templates from the server for a specific cluster.
 *
 * @param listing - Contains server information, including the cluster's unique ID and conductor URL.
 * @returns A promise that resolves to an array of templates if the request is successful, or undefined if an error occurs.
 */
export const fetchTemplates = async (
  listing: ListingsObject
): Promise<GetListTemplatesResponse | undefined> => {
  try {
    // Retrieve a JWT token for the given cluster ID to authenticate the request
    const jwt_token = await getTokenForCluster(listing._id);

    // If no token is available, log an error and exit
    if (!jwt_token) {
      console.error('No token available for this cluster.');
      return undefined;
    }

    // Make a request to the server to fetch the templates
    const response = await fetch(`${listing.conductor_url}/api/templates`, {
      headers: {
        Authorization: `Bearer ${jwt_token}`,
        'Content-Type': 'application/json',
      },
    });

    // If the server responds with an error, log the failure and return undefined
    if (!response.ok) {
      console.error(`Failed to fetch templates: ${response.statusText}`);
      return undefined;
    }

    // Parse and return the response data as JSON
    const data: GetListTemplatesResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching templates:', error);
    return undefined;
  }
};
