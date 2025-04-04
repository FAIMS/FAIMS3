import {useQuery} from '@tanstack/react-query';
import {User} from '@/context/auth-provider';
import {
  GetListTeamsResponse,
  GetListTemplatesResponse,
  GetProjectInvitesResponse,
  GetTeamByIdResponse,
  GetTeamInvitesResponse,
  GetTeamMembersResponse,
} from '@faims3/data-model';
import QRCode from 'qrcode';

/**
 * get function is a utility function for making GET requests to the API.
 *
 * @param {string} path - The path to the API endpoint.
 * @param {User | null} user - The user object.
 * @returns {Promise<any>} A promise that resolves to the response data.
 */
export const get = async (path: string, user: User | null) => {
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
 * useGetProjects hook returns a query for fetching projects.
 *
 * @param {User} user - The user object.
 * @returns {Query} A query for fetching projects.
 */
export const useGetProjects = (user: User | null, projectId?: string) =>
  useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => get(`/api/notebooks/${projectId || ''}`, user),
  });

/**
 * useGetProjectsForTeam hook returns a query for fetching projects.
 *
 * @param {User} user - The user object.
 * @returns {Query} A query for fetching projects.
 */
export const useGetProjectsForTeam = ({
  teamId,
  user,
}: {
  user: User | null;
  teamId: string;
}) =>
  useQuery({
    queryKey: ['projectsbyteam', teamId],
    queryFn: () => get(`/api/notebooks?teamId=${teamId}`, user),
  });

/**
 * useGetTemplatesForTeam hook returns a query for fetching projects.
 *
 * @param {User} user - The user object.
 * @returns {Query} A query for fetching projects.
 */
export const useGetTemplatesForTeam = ({
  teamId,
  user,
}: {
  user: User | null;
  teamId: string;
}) =>
  useQuery({
    queryKey: ['templatesbyteam', teamId],
    queryFn: async () => {
      return (await get(
        `/api/templates?teamId=${teamId}`,
        user
      )) as GetListTemplatesResponse;
    },
  });

/**
 * @param {User} user - The user object.
 */
export const useGetUsersForTeam = ({
  teamId,
  user,
}: {
  user: User;
  teamId: string;
}) =>
  useQuery({
    queryKey: ['teamusers', teamId],
    queryFn: async () => {
      return (await get(
        `/api/teams/${teamId}/members`,
        user
      )) as GetTeamMembersResponse;
    },
  });

/**
 * Gets a particular team
 *
 * @param {User} user - The user object.
 * @returns {Query} A query for fetching projects.
 */
export const useGetTeam = (user: User | null, teamId: string | undefined) =>
  useQuery({
    queryKey: ['teams', teamId],
    queryFn: async () => {
      if (!teamId) {
        return null;
      }
      return (await get(`/api/teams/${teamId}`, user)) as GetTeamByIdResponse;
    },
  });

/**
 * useGetTeams hook returns a query for fetching projects.
 *
 * @param {User} user - The user object.
 * @returns {Query} A query for fetching projects.
 */
export const useGetTeams = (user: User | null) =>
  useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      return (await get('/api/teams/', user)) as GetListTeamsResponse;
    },
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
    queryFn: () => get('/api/users', user),
  });

/**
 * useGetProjectInvites hook returns a query for fetching invites.
 *
 * @param {User} user - The user object.
 * @param {string} notebookId - The ID of the notebook.
 * @returns {Query} A query for fetching invites.
 */
export const useGetProjectInvites = (user: User | null, notebookId: string) =>
  useQuery({
    queryKey: ['projectinvites', notebookId],
    queryFn: async () => {
      const invites = (await get(
        `/api/invites/project/${notebookId}`,
        user
      )) as GetProjectInvitesResponse;
      const promises = invites.map(async invite => {
        const url = `${import.meta.env.VITE_API_URL}/register/${invite._id}`;
        return {
          ...invite,
          url: url,
          qrCode: await QRCode.toDataURL(url),
        };
      });
      return Promise.all(promises); // Resolving all promises to get enhanced invites
    },
    enabled: !!user && !!notebookId, // Only run the query if both user and notebookId are available
  });

/**
 * useGetTeamInvites hook returns a query for fetching invites.
 *
 * @param {User} user - The user object.
 * @param {string} teamId - The ID of the notebook.
 * @returns {Query} A query for fetching invites.
 */
export const useGetTeamInvites = (user: User | null, teamId: string) =>
  useQuery({
    queryKey: ['teaminvites', teamId],
    queryFn: async () => {
      const invites = (await get(
        `/api/invites/team/${teamId}`,
        user
      )) as GetTeamInvitesResponse;
      const promises = invites.map(async invite => {
        const url = `${import.meta.env.VITE_API_URL}/register/${invite._id}`;
        return {
          ...invite,
          url: url,
          qrCode: await QRCode.toDataURL(url),
        };
      });
      return Promise.all(promises); // Resolving all promises to get enhanced invites
    },
    enabled: !!user && !!teamId, // Only run the query if both user and notebookId are available
  });

/**
 * useGetRecords hook returns a query for fetching records.
 * @param {User} user - The user object.
 * @param {string} projectId - The ID of the project.
 * @returns {Query} A query for fetching records.
 */
export const useGetRecords = (user: User | null, projectId: string) =>
  useQuery({
    queryKey: ['records', projectId],
    queryFn: () => get(`/api/notebooks/${projectId}/records/`, user),
  });

/**
 * useGetRoles hook returns a query for fetching roles.
 * @param {User} user - The user object.
 * @returns {Query} A query for fetching roles.
 */
export const useGetRoles = (user: User | null) =>
  useQuery({
    queryKey: ['roles'],
    queryFn: () => get('/api/users/roles', user),
  });
