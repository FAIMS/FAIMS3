// SPDX-License-Identifier: Apache-2.0
import {config, buildRegisterUrl} from '@/constants';
import {User} from '@/context/auth-provider';
import {sortNotebookListNewestFirst} from '@/lib/utils';
import type {
  GetCurrentUserResponse,
  GetListAllUsersResponse,
  GetLongLivedTokensResponse,
  GetNotebookListWithStatsResponse,
  GetTemplateByIdResponse,
  PostCreateLongLivedTokenRequest,
  PostCreateLongLivedTokenResponse,
  PostRequestEmailVerificationRequest,
  PostRequestEmailVerificationResponse,
  PutRevokeLongLivedTokenResponse,
  PutUpdateLongLivedTokenResponse,
  RecordMetadata,
} from '@faims3/data-model';
import {
  GetListTeamsResponse,
  GetListTemplatesResponse,
  GetNotebookResponse,
  GetNotebookUsersResponse,
  GetProjectInvitesResponse,
  GetTeamByIdResponse,
  GetTeamInvitesResponse,
  GetTeamMembersResponse,
  TEMPLATE_LIST_LIMIT_MAX,
} from '@faims3/data-model';
import {useState} from 'react';
import {getTemplateSurveyReferences} from '@/hooks/template-hooks';
import {useMutation, useQuery} from '@tanstack/react-query';
import QRCode from 'qrcode';

/**
 * post function is a utility function for making POST requests to the API.
 *
 * @param {string} path - The path to the API endpoint.
 * @param {User | null} user - The user object.
 * @returns {Promise<any>} A promise that resolves to the response data.
 */
export const post = async <TPayload, TResponse>({
  user,
  data,
  path,
}: {
  path: string;
  data: TPayload;
  user: User;
}) => {
  const response = await fetch(`${config.apiUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user.token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) throw new Error(response.statusText);

  return (await response.json()) as TResponse;
};

/**
 * get function is a utility function for making GET requests to the API.
 *
 * @param {string} path - The path to the API endpoint.
 * @param {User | null} user - The user object.
 * @returns {Promise<any>} A promise that resolves to the response data.
 */
export const get = async <T = any>(
  path: string,
  user: User | null,
  token: string | null = null
) => {
  if (!user && !token) throw new Error('Not authenticated');

  const response = await fetch(`${config.apiUrl}${path}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user ? user.token : token}`,
    },
  });

  if (!response.ok) throw new Error(response.statusText);

  return (await response.json()) as T;
};

/**
 * Fetches details about the current user
 * @returns GetCurrentUserResponse or throws
 */
export const getCurrentUser = async ({token}: {token: string}) => {
  return await get<GetCurrentUserResponse>('/api/users/current', null, token);
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
export const useGetProjects = ({
  user,
  enabled = true,
  includeArchived = false,
}: {
  user: User | null;
  enabled?: boolean;
  /** When true, lists archived notebooks/projects too (directory-style sync uses this). */
  includeArchived?: boolean;
}) =>
  useQuery({
    queryKey: ['projects', user?.token, includeArchived, 'stats'],
    queryFn: () =>
      get<GetNotebookListWithStatsResponse>(
        includeArchived
          ? '/api/notebooks/?includeByteCount=true&includeArchived=true'
          : '/api/notebooks/?includeByteCount=true',
        user
      ),
    select: sortNotebookListNewestFirst,
    enabled: !!user && enabled,
  });

/**
 * useGetTemplate hook returns a query for fetching a template.
 *
 * @param {User} user - The user object.
 * @param {string} templateId - The ID of the template.
 * @returns {Query} A query for fetching a template.
 */
export const useGetTemplate = ({
  user,
  templateId,
  enabled = true,
}: {
  user: User | null;
  templateId: string;
  enabled?: boolean;
}) =>
  useQuery({
    queryKey: ['templates', templateId],
    queryFn: () =>
      get<GetTemplateByIdResponse>(`/api/templates/${templateId}`, user),
    enabled: !!user && !!templateId && enabled,
  });

/**
 * Notebook reference counts for delete-confirmation copy (archived template flow).
 */
export const useTemplateSurveyReferences = ({
  user,
  templateId,
  enabled = true,
}: {
  user: User | null;
  templateId: string;
  enabled?: boolean;
}) =>
  useQuery({
    queryKey: ['templates', templateId, 'references'],
    queryFn: async () => {
      if (!user) {
        throw new Error('Not authenticated');
      }
      return getTemplateSurveyReferences({user, templateId});
    },
    enabled: !!user && !!templateId && enabled,
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
  includeArchived = false,
}: {
  user: User | null;
  teamId: string;
  includeArchived?: boolean;
}) =>
  useQuery({
    queryKey: ['projectsbyteam', user?.token, teamId, includeArchived, 'stats'],
    queryFn: () =>
      get<GetNotebookListWithStatsResponse>(
        `/api/notebooks?teamId=${teamId}&includeByteCount=true${includeArchived ? '&includeArchived=true' : ''}`,
        user
      ),
    select: sortNotebookListNewestFirst,
  });

export type TemplatesListQueryArgs = {
  teamId?: string;
  includeArchived?: boolean;
  limit?: number;
  startKey?: string;
};

/**
 * Path and React Query key for GET /api/templates. `limit` / `startKey` are
 * part of the key so each table page is a distinct request.
 */
export function buildTemplatesListRequest({
  teamId,
  includeArchived = false,
  limit,
  startKey,
}: TemplatesListQueryArgs): {path: string; queryKey: unknown[]} {
  const params = new URLSearchParams();
  if (includeArchived) params.set('includeArchived', 'true');
  if (teamId) params.set('teamId', teamId);
  if (limit !== undefined) params.set('limit', String(limit));
  if (startKey) params.set('startKey', startKey);
  const qs = params.toString();
  return {
    path: `/api/templates${qs ? `?${qs}` : ''}`,
    queryKey: [
      'templates',
      includeArchived ? 'archived' : 'active',
      teamId ?? null,
      limit ?? null,
      startKey ?? null,
    ],
  };
}

/**
 * useGetTemplatesForTeam hook returns a query for fetching team templates.
 */
export const useGetTemplatesForTeam = ({
  teamId,
  user,
  limit,
  startKey,
  includeArchived = false,
}: {
  user: User | null;
  teamId: string;
  limit?: number;
  startKey?: string;
  includeArchived?: boolean;
}) =>
  useGetTemplates({
    user,
    teamId,
    limit,
    startKey,
    includeArchived,
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
 * @returns {Query} A query for fetching a team.
 */
export const useGetTeam = ({
  user,
  teamId,
  enabled: enabledOption = true,
}: {
  user: User | null;
  teamId: string | undefined;
  /** When false, the team request is skipped (e.g. team label already provided by another API). */
  enabled?: boolean;
}) =>
  useQuery({
    queryKey: ['teams', teamId],
    queryFn: async () => get<GetTeamByIdResponse>(`/api/teams/${teamId}`, user),
    enabled: !!user && !!teamId && enabledOption,
  });

/**
 * useGetTeams hook returns a query for fetching projects.
 *
 * @param {User} user - The user object.
 * @returns {Query} A query for fetching projects.
 */
export const useGetTeams = ({
  user,
  enabled = true,
}: {
  user: User | null;
  enabled?: boolean;
}) =>
  useQuery({
    queryKey: ['teams'],
    queryFn: async () => get<GetListTeamsResponse>('/api/teams/', user),
    enabled: !!user && enabled,
  });

/**
 * useGetTemplates hook returns a query for fetching one page of templates.
 * By default archived templates are excluded. Pass includeArchived: true for the Archive section.
 * Callers that used to treat the result as an unbounded array must read
 * `data.templates` and `data.nextStartKey`.
 */
export const useGetTemplates = ({
  user,
  enabled = true,
  includeArchived = false,
  teamId,
  limit,
  startKey,
}: {
  user: User | null;
  enabled?: boolean;
  /** When true, lists only archived templates (requires includeArchived=true on the API). */
  includeArchived?: boolean;
  teamId?: string;
  limit?: number;
  startKey?: string;
}) => {
  const {path, queryKey} = buildTemplatesListRequest({
    teamId,
    includeArchived,
    limit,
    startKey,
  });
  return useQuery({
    queryKey: [...queryKey, user?.token],
    queryFn: async () => get<GetListTemplatesResponse>(path, user),
    enabled: !!user && enabled,
  });
};

/**
 * Cursor-stack pagination for Control Centre template tables. Next uses
 * `nextStartKey`; Previous re-requests the previous page's startKey.
 * Next stays available when `nextStartKey` is set even on a short or empty page.
 */
export const usePagedTemplates = ({
  user,
  enabled = true,
  includeArchived = false,
  teamId,
  defaultPageSize = 10,
}: {
  user: User | null;
  enabled?: boolean;
  includeArchived?: boolean;
  teamId?: string;
  defaultPageSize?: number;
}) => {
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [startKey, setStartKey] = useState<string | undefined>(undefined);
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([]);

  const query = useGetTemplates({
    user,
    enabled,
    includeArchived,
    teamId,
    limit: pageSize,
    startKey,
  });

  const hasNextPage = query.data?.nextStartKey !== undefined;
  const pageIndex = cursorStack.length;

  const goNext = () => {
    const next = query.data?.nextStartKey;
    if (next === undefined) return;
    setCursorStack(stack => [...stack, startKey]);
    setStartKey(next);
  };

  const goPrevious = () => {
    setCursorStack(stack => {
      if (stack.length === 0) return stack;
      const nextStack = stack.slice(0, -1);
      setStartKey(stack[stack.length - 1]);
      return nextStack;
    });
  };

  const goFirst = () => {
    setCursorStack([]);
    setStartKey(undefined);
  };

  const changePageSize = (size: number) => {
    setPageSize(size);
    setCursorStack([]);
    setStartKey(undefined);
  };

  return {
    ...query,
    templates: query.data?.templates,
    pageSize,
    pageIndex,
    hasNextPage,
    canPreviousPage: pageIndex > 0,
    goNext,
    goPrevious,
    goFirst,
    changePageSize,
  };
};

/** Compact consumers (sidebar, create-survey picker) stay on the same GET. */
export const TEMPLATE_CATALOGUE_PICKER_LIMIT = TEMPLATE_LIST_LIMIT_MAX;

/**
 * useGetUsers hook returns a query for fetching users.
 * Disabled accounts are omitted unless `includeArchived` is true (matches API `includeArchived` query param).
 *
 * @param {User} user - The user object.
 * @returns {Query} A query for fetching users.
 */
export const useGetUsers = ({
  user,
  enabled = true,
  includeArchived = false,
}: {
  user: User | null;
  enabled?: boolean;
  includeArchived?: boolean;
}) =>
  useQuery({
    queryKey: ['users', includeArchived],
    queryFn: () => {
      const qs = includeArchived ? '?includeArchived=true' : '';
      return get<GetListAllUsersResponse>(`/api/users${qs}`, user);
    },
    enabled: !!user && enabled,
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
 * useGetTeamInvites hook returns a query for fetching invites.
 *
 * @param {User} user - The user object.
 * @param {string} teamId - The ID of the notebook.
 * @returns {Query} A query for fetching invites.
 */
export const useGetGlobalInvites = ({
  user,
  redirect,
}: {
  user: User | null;
  redirect: string;
}) =>
  useQuery({
    queryKey: ['globalinvites'],
    queryFn: async () => {
      const invites = await get<GetTeamInvitesResponse>(
        '/api/invites/global',
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
    enabled: !!user,
  });

/**
 * useGetRecords hook returns a query for fetching records.
 * @param {User} user - The user object.
 * @param {string} projectId - The ID of the project.
 * @returns {Query} A query for fetching records.
 */
export const useGetRecords = ({
  user,
  projectId,
}: {
  user: User | null;
  projectId: string;
}) =>
  useQuery({
    queryKey: ['records', projectId],
    queryFn: () =>
      get<{records: RecordMetadata[]}>(
        `/api/notebooks/${projectId}/records/`,
        user
      ),
    enabled: !!user,
  });

/**
 * @param projectId - the project ID to lookup
 * @param user - The user object.
 */
export const useGetUsersForProject = ({
  projectId,
  user,
}: {
  user: User | null;
  projectId: string;
}) =>
  useQuery({
    queryKey: ['projectusers', projectId],
    queryFn: async () => {
      return await get<GetNotebookUsersResponse>(
        `/api/notebooks/${projectId}/users`,
        user
      );
    },
    enabled: !!user,
  });

/**
 * useGetProject hook returns a query for fetching a project.
 *
 * @param {User} user - The user object.
 * @param {string} projectId - The ID of the project.
 * @returns {Query} A query for fetching a project.
 */
export const useRequestVerify = () => {
  return useMutation({
    mutationFn: async ({user}: {user: User}) => {
      return await post<
        PostRequestEmailVerificationRequest,
        PostRequestEmailVerificationResponse
      >({path: '/api/verify', data: {email: user.user.email}, user: user});
    },
  });
};

/**
 * useGetLongLivedTokens hook returns a query for fetching long lived tokens.
 *
 * @param {User} user - The user object.
 * @param {boolean} fetchAll - Whether to fetch all long lived tokens or only the user's.
 * @returns {Query} A query for fetching long lived tokens.
 */
export const useGetLongLivedTokens = ({
  user,
  fetchAll,
}: {
  user: User;
  fetchAll: boolean;
}) =>
  useQuery({
    queryKey: ['long-lived-tokens', user.user.id, fetchAll],
    queryFn: () =>
      get<GetLongLivedTokensResponse>(
        '/api/long-lived-tokens' + (fetchAll ? '?all=true' : ''),
        user
      ),
  });

/**
 * Creates a long-lived token for a user.
 *
 * @param title - The title of the token.
 * @param expiryTimestampMs - The expiration timestamp in milliseconds.
 * @param description - The description of the token.
 * @param user - The user object.
 */
export const createLongLivedToken = async ({
  user,
  title,
  expiryTimestampMs,
  description,
}: PostCreateLongLivedTokenRequest & {user: User}) =>
  await post<PostCreateLongLivedTokenRequest, PostCreateLongLivedTokenResponse>(
    {
      user,
      data: {
        title,
        expiryTimestampMs,
        description,
      },
      path: '/api/long-lived-tokens',
    }
  );

/**
 * Updates an existing long-lived token's metadata.
 *
 * @param tokenId - The ID of the token to update.
 * @param title - The new title of the token (optional).
 * @param description - The new description of the token (optional).
 * @param user - The user object.
 */
export const updateLongLivedToken = async ({
  user,
  tokenId,
  title,
  description,
}: {
  tokenId: string;
  title?: string;
  description?: string;
  user: User;
}) => {
  const response = await fetch(
    `${config.apiUrl}/api/long-lived-tokens/${tokenId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.token}`,
      },
      body: JSON.stringify({
        ...(title !== undefined && {title}),
        ...(description !== undefined && {description}),
      }),
    }
  );

  if (!response.ok) throw new Error(response.statusText);

  return (await response.json()) as PutUpdateLongLivedTokenResponse;
};

/**
 * Revokes (disables) a long-lived token.
 *
 * @param tokenId - The ID of the token to revoke.
 * @param user - The user object.
 */
export const revokeLongLivedToken = async ({
  user,
  tokenId,
}: {
  tokenId: string;
  user: User;
}) => {
  const response = await fetch(
    `${config.apiUrl}/api/long-lived-tokens/${tokenId}`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.token}`,
      },
      body: JSON.stringify({}),
    }
  );

  if (!response.ok) throw new Error(response.statusText);

  return (await response.json()) as PutRevokeLongLivedTokenResponse;
};
