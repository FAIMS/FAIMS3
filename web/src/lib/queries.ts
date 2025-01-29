import {useQuery} from '@tanstack/react-query';
import {User} from '@/auth';

/**
 * get function is a utility function for making GET requests to the API.
 *
 * @param {string} path - The path to the API endpoint.
 * @param {User | null} user - The user object.
 * @returns {Promise<any>} A promise that resolves to the response data.
 */
const get = async (path: string, user: User | null) => {
  if (!user) return {error: 'Not authenticated'};

  const response = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user.token}`,
    },
  });

  if (!response.ok) return {error: response.statusText};

  return await response.json();
};

/**
 * useGetSurveys hook returns a query for fetching surveys.
 *
 * @param {User} user - The user object.
 * @returns {Query} A query for fetching surveys.
 */
export const useGetSurveys = (user: User | null, surveyId?: string) =>
  useQuery({
    queryKey: ['surveys', surveyId],
    queryFn: () => get(`/api/notebooks/${surveyId || ''}`, user),
  });

/**
 * useGetTemplates hook returns a query for fetching templates.
 *
 * @param {User} user - The user object.
 * @returns {Query} A query for fetching templates.
 */
export const useGetTemplates = (user: User | null, templateId?: string) =>
  useQuery({
    queryKey: ['templates', templateId],
    queryFn: async () => {
      const data = await get(`/api/templates/${templateId || ''}`, user);

      if (!templateId) return data.templates;

      return data;
    },
  });

/**
 * useGetUsers hook returns a query for fetching users.
 *
 * @param {User} user - The user object.
 * @returns {Query} A query for fetching users.
 */
export const useGetUsers = (user: User | null) =>
  useQuery({
    queryKey: ['users'],
    queryFn: () => get(`/api/users`, user),
  });
