import {User} from '@/context/auth-provider';

/**
 * archiveTemplate function fetches the template with the specified ID and
 * increments the version and sets the project_status to archived.
 * @param {User} user - The user object.
 * @param {string} id - The ID of the template to archive.
 * @returns {Promise<Response>} A promise that resolves to the response data.
 */
export const archiveTemplate = async (user: User | null, id: string) =>
  await fetch(`${import.meta.env.VITE_API_URL}/api/templates/${id}/archive`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user?.token}`,
    },
  });
