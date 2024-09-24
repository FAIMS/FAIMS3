/*
 * notebooks.ts
 * This module handles creating notebooks from templates.
 */

import {getTokenForCluster} from '../users';
import {ListingsObject} from './databases';

/**
 * Create a notebook from a selected template.
 * @param listing - Information about the server listing.
 * @param templateId - The ID of the selected template.
 * @param surveyName - The name of the survey to be created.
 * @returns The created notebook's data if successful, or an error if it fails.
 */
export const createNotebookFromTemplate = async (
  listing: ListingsObject,
  templateId: string,
  surveyName: string
): Promise<any> => {
  try {
    const jwt_token = await getTokenForCluster(listing._id);

    if (!jwt_token) {
      throw new Error('No token available for this cluster.');
    }

    const response = await fetch(`${listing.conductor_url}/api/notebooks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: surveyName, // Survey name provided by the user
        template_id: templateId, // The selected template ID
      }),
    });

    if (!response.ok) {
      const errorMessage = await response.text();
      throw new Error(`Failed to create notebook: ${errorMessage}`);
    }

    const data = await response.json();
    console.log('the data in notebook module', data);
    return data;
  } catch (error) {
    console.error('Error creating notebook:', error);
    throw error;
  }
};
