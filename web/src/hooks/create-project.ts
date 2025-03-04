import {User} from '@/context/auth-provider';
import {readFileAsText} from '@/lib/utils';

/**
 * Creates a new project from a template
 * @param {User} user - The user object
 * @param {string} name - The name of the project
 * @param {string} template - The template ID
 * @returns {Promise<Response>} The response from the API
 */
export const createProjectFromTemplate = async (
  user: User,
  name: string,
  template: string
) =>
  await fetch(`${import.meta.env.VITE_API_URL}/api/notebooks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user.token}`,
    },
    body: JSON.stringify({
      template_id: template,
      name,
    }),
  });

/**
 * Creates a new project from a file
 * @param {User} user - The user object
 * @param {string} name - The name of the project
 * @param {File} file - The file to upload
 * @returns {Promise<Response>} The response from the API
 */
export const createProjectFromFile = async (
  user: User,
  name: string,
  file: File
) => {
  const jsonString = await readFileAsText(file);

  return await fetch(`${import.meta.env.VITE_API_URL}/api/notebooks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user.token}`,
    },
    body: JSON.stringify({name, ...JSON.parse(jsonString)}),
  });
};
