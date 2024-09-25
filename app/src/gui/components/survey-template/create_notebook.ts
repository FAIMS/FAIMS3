/*
 * create_notebook.ts
 * This module is responsible for creating notebooks from templates.
 * It interacts with the server's API to initiate the creation of notebooks using selected templates.
 */

import {ListingsObject} from '../../../sync/databases';
import {getTokenForCluster} from '../../../users';

/**
 * Creates a notebook based on the provided template and survey name.
 *
 * @param listing - Information about the server listing, including its ID and conductor URL.
 * @param templateId - The ID of the selected template that will be used to create the notebook.
 * @param surveyName - The name assigned to the new survey or notebook.
 * @returns The data related to the created notebook if successful, or throws an error if it fails.
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

    // Make an API request to create the notebook from the selected template
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
