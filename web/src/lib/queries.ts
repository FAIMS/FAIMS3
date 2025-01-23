import {useQuery} from '@tanstack/react-query';
import {get} from './utils';
import {User} from '@/auth';

/**
 * useGetSurveys hook returns a query for fetching surveys.
 *
 * @param {User} user - The user object.
 * @returns {Query} A query for fetching surveys.
 */
export const useGetSurveys = (user: User) =>
  useQuery({
    queryKey: ['surveys'],
    queryFn: () => get('/api/notebooks', user),
  });

/**
 * useGetTemplates hook returns a query for fetching templates.
 *
 * @param {User} user - The user object.
 * @returns {Query} A query for fetching templates.
 */
export const useGetTemplates = (user: User) =>
  useQuery({
    queryKey: ['templates'],
    queryFn: async () => (await get('/api/templates', user)).templates,
  });
