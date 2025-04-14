import {buildRegisterUrl} from '@/constants';
import {User} from '@/context/auth-provider';
import type {
  GetNotebookListResponse,
  GetTemplateByIdResponse,
  PeopleDBDocument,
  RecordMetadata,
} from '@faims3/data-model';
import {
  GetListTeamsResponse,
  GetListTemplatesResponse,
  GetNotebookResponse,
  GetProjectInvitesResponse,
  GetTeamByIdResponse,
  GetTeamInvitesResponse,
  GetTeamMembersResponse,
} from '@faims3/data-model';
import {useQuery} from '@tanstack/react-query';
import QRCode from 'qrcode';

/**
 * get function is a utility function for making GET requests to the API.
 *
 * @param {string} path - The path to the API endpoint.
 * @param {User | null} user - The user object.
 * @returns {Promise<any>} A promise that resolves to the response data.
 */
export const get = async <T = any>(path: string, user: User | null) => {
  if (!user) throw new Error('Not authenticated');

  const response = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user.token}`,
    },
  });

  if (!response.ok) throw new Error(response.statusText);

  return (await response.json()) as T;
};

/**
 * useGetProject hook returns a query for fetching a project.
 *
 * @param {User} user - The user object.
 * @param {string} projectId - The ID of the project.
 * @returns {Query} A query for fetching a project.
 */
export const useGetProject = ({
  user,
  projectId,
}: {
  user: User | null;
  projectId: string;
}) =>
  useQuery({
    queryKey: ['projects', projectId],
    queryFn: () =>
      get<GetNotebookResponse>(`/api/notebooks/${projectId}`, user),
    enabled: !!user,
  });

/**
 * useGetProjects hook returns a query for fetching projects.
 *
 * @param {User} user - The user object.
 * @returns {Query} A query for fetching projects.
 */
export const useGetProjects = (user: User | null) =>
  useQuery({
    queryKey: ['projects'],
    queryFn: () => get<GetNotebookListResponse>('/api/notebooks/', user),
    enabled: !!user,
  });

/**
 * useGetTemplate hook returns a query for fetching a template.
 *
 * @param {User} user - The user object.
 * @param {string} templateId - The ID of the template.
 * @returns {Query} A query for fetching a template.
 */
export const useGetTemplate = (user: User | null, templateId: string) =>
  useQuery({
    queryKey: ['templates', templateId],
    queryFn: () =>
      get<GetTemplateByIdResponse>(`/api/templates/${templateId}`, user),
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
    queryFn: () =>
      get<GetNotebookListResponse>(`/api/notebooks?teamId=${teamId}`, user),
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
    queryFn: async () =>
      get<GetListTemplatesResponse>(`/api/templates?teamId=${teamId}`, user),
    enabled: !!user,
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
    queryFn: async () => get<GetTeamByIdResponse>(`/api/teams/${teamId}`, user),
    enabled: !!user && !!teamId,
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
    queryFn: async () => get<GetListTeamsResponse>('/api/teams/', user),
    enabled: !!user,
  });

/**
 * useGetTemplates hook returns a query for fetching templates.
 *
 * @param {User} user - The user object.
 * @returns {Query} A query for fetching templates.
 */
export const useGetTemplates = (user: User | null) =>
  useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const data = await get<GetListTemplatesResponse>('/api/templates/', user);
      return data.templates;
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
    queryFn: () => get<PeopleDBDocument[]>('/api/users', user),
  });

/**
 * useGetProjectInvites hook returns a query for fetching invites.
 *
 * @param {User} user - The user object.
 * @param {string} projectId - The ID of the notebook.
 * @returns {Query} A query for fetching invites.
 */
export const useGetProjectInvites = ({
  user,
  redirect,
  projectId,
}: {
  user: User | null;
  projectId: string;
  redirect: string;
}) =>
  useQuery({
    queryKey: ['projectinvites', projectId],
    queryFn: async () => {
      const invites = await get<GetProjectInvitesResponse>(
        `/api/invites/notebook/${projectId}`,
        user
      );
      const promises = invites.map(async invite => {
        const url = buildRegisterUrl({inviteId: invite._id, redirect});
        return {
          ...invite,
          url: url,
          qrCode: await QRCode.toDataURL(url),
        };
      });
      // Resolving all promises to get enhanced invites
      return Promise.all(promises);
    },
    // Only run the query if both user and notebookId are available
    enabled: !!user && !!projectId,
  });

/**
 * useGetTeamInvites hook returns a query for fetching invites.
 *
 * @param {User} user - The user object.
 * @param {string} teamId - The ID of the notebook.
 * @returns {Query} A query for fetching invites.
 */
export const useGetTeamInvites = ({
  user,
  teamId,
  redirect,
}: {
  user: User | null;
  teamId: string;
  redirect: string;
}) =>
  useQuery({
    queryKey: ['teaminvites', teamId],
    queryFn: async () => {
      const invites = await get<GetTeamInvitesResponse>(
        `/api/invites/team/${teamId}`,
        user
      );
      const promises = invites.map(async invite => {
        const url = buildRegisterUrl({inviteId: invite._id, redirect});
        return {
          ...invite,
          url: url,
          qrCode: await QRCode.toDataURL(url),
        };
      });
      return Promise.all(promises);
    },
    // Only run the query if both user and notebookId are available
    enabled: !!user && !!teamId,
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
    queryFn: () =>
      get<{records: RecordMetadata[]}>(
        `/api/notebooks/${projectId}/records/`,
        user
      ),
    enabled: !!user,
  });
