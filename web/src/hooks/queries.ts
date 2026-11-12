// SPDX-License-Identifier: Apache-2.0
import {config, buildRegisterUrl} from '@/constants';
import {User} from '@/context/auth-provider';
import type {
  GetAdminStatsPeopleResponse,
  GetAdminStatsResponse,
  GetAdminStatsTeamsResponse,
  GetCurrentUserResponse,
  GetGlobalInvitesResponse,
  GetListAllUsersResponse,
  GetLongLivedTokensResponse,
  GetNotebookListResponse,
  GetTeamNotebookStorageResponse,
  GetTemplateByIdResponse,
  NotebookListStatus,
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
} from '@faims3/data-model';
import {getTemplateSurveyReferences} from '@/hooks/template-hooks';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import QRCode from 'qrcode';
import {get, post} from './api-fetch';
import {
  listPath,
  PICKER_PAGE_SIZE,
  useInfiniteList,
  usePagedList,
  type ListPageArgs,
  type ListRequest,
} from './paged-list';

export {get, post};

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

/** Query fields for GET /api/notebooks list requests. */
export type NotebooksListQueryArgs = ListPageArgs & {
  /** Only surveys owned by this team. */
  teamId?: string;
  /** Only surveys created from this template. */
  templateId?: string;
  /** `active` (default) leaves archived surveys out; `all` lists active first. */
  status?: NotebookListStatus;
  /**
   * Attach `byteCount` to each row of the page (one Couch `info()` per row on
   * the server). Off by default: no Control Centre table shows it.
   */
  includeByteCount?: boolean;
};

/**
 * Path and React Query key for one GET /api/notebooks page. Team lists live
 * under `['projectsbyteam', token, teamId]` and the rest under
 * `['projects', token]`, so the existing invalidations reach every page.
 */
export function buildNotebooksListRequest(
  {
    teamId,
    templateId,
    status = 'active',
    includeByteCount = false,
    limit,
    startKey,
  }: NotebooksListQueryArgs,
  user: User | null
): ListRequest {
  return {
    path: listPath('/api/notebooks/', {
      teamId,
      templateId,
      status: status === 'active' ? undefined : status,
      includeByteCount,
      limit,
      startKey,
    }),
    queryKey: [
      ...(teamId
        ? ['projectsbyteam', user?.token, teamId]
        : ['projects', user?.token]),
      'list',
      status,
      templateId ?? null,
      includeByteCount ? 'stats' : 'names',
      limit ?? null,
      startKey ?? null,
    ],
  };
}

/**
 * One page of surveys the user can read, newest first. Read
 * `data.notebooks` and `data.nextStartKey`; omitting `limit` gets the API
 * default page (50), never the whole catalogue.
 */
export const useGetProjects = ({
  user,
  enabled = true,
  ...args
}: NotebooksListQueryArgs & {
  user: User | null;
  enabled?: boolean;
}) => {
  const {path, queryKey} = buildNotebooksListRequest(args, user);
  return useQuery({
    queryKey,
    queryFn: () => get<GetNotebookListResponse>(path, user),
    enabled: !!user && enabled,
  });
};

/**
 * Cursor-paged surveys for Control Centre tables: the whole catalogue, one
 * team's (`teamId`), one template's (`templateId`), or the archive
 * (`status: 'archived'`).
 */
export const usePagedProjects = ({
  user,
  enabled = true,
  teamId,
  templateId,
  status = 'active',
  defaultPageSize,
}: {
  user: User | null;
  enabled?: boolean;
  teamId?: string;
  templateId?: string;
  status?: NotebookListStatus;
  defaultPageSize?: number;
}) => {
  const {items, ...paged} = usePagedList<GetNotebookListResponse, 'notebooks'>({
    user,
    enabled,
    scope: `${status}:${teamId ?? ''}:${templateId ?? ''}`,
    defaultPageSize,
    buildRequest: page =>
      buildNotebooksListRequest({teamId, templateId, status, ...page}, user),
    itemsKey: 'notebooks',
  });
  return {...paged, notebooks: items};
};

/**
 * Survey counts and stored bytes for a team, overall and per status, summed
 * on the server (`GET /api/teams/:id/notebook-storage`). Keyed under
 * `projectsbyteam` so survey changes refresh it.
 */
export const useGetTeamNotebookStorage = ({
  user,
  teamId,
}: {
  user: User | null;
  teamId: string;
}) =>
  useQuery({
    queryKey: ['projectsbyteam', user?.token, teamId, 'storage'],
    queryFn: () =>
      get<GetTeamNotebookStorageResponse>(
        `/api/teams/${teamId}/notebook-storage`,
        user
      ),
    enabled: !!user && !!teamId,
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

/** Query fields for GET /api/templates list requests. */
export type TemplatesListQueryArgs = {
  teamId?: string;
  includeArchived?: boolean;
  limit?: number;
  startKey?: string;
  visibility?: 'public' | 'private';
};

/**
 * Path and React Query key for GET /api/templates. `limit` / `startKey` /
 * `visibility` are part of the key so each table page is a distinct request.
 */
export function buildTemplatesListRequest({
  teamId,
  includeArchived = false,
  limit,
  startKey,
  visibility,
}: TemplatesListQueryArgs): {path: string; queryKey: unknown[]} {
  return {
    path: listPath('/api/templates', {
      includeArchived,
      teamId,
      limit,
      startKey,
      visibility,
    }),
    queryKey: [
      'templates',
      includeArchived ? 'archived' : 'active',
      teamId ?? null,
      limit ?? null,
      startKey ?? null,
      visibility ?? null,
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
 * Path and React Query key for one GET /api/teams/:id/members page. Keyed
 * under `['teamusers', teamId]`.
 */
export function buildTeamMembersListRequest(
  teamId: string,
  {limit, startKey}: ListPageArgs
): ListRequest {
  return {
    path: listPath(`/api/teams/${teamId}/members`, {limit, startKey}),
    queryKey: ['teamusers', teamId, limit ?? null, startKey ?? null],
  };
}

/** Cursor-paged team members in name order, for the team Users tab. */
export const usePagedTeamMembers = ({
  teamId,
  user,
  defaultPageSize,
}: {
  user: User | null;
  teamId: string;
  defaultPageSize?: number;
}) => {
  const {items, ...paged} = usePagedList<GetTeamMembersResponse, 'members'>({
    user,
    scope: teamId,
    defaultPageSize,
    buildRequest: page => buildTeamMembersListRequest(teamId, page),
    itemsKey: 'members',
  });
  return {...paged, members: items};
};

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

/** Query fields for GET /api/teams list requests. */
export type TeamsListQueryArgs = ListPageArgs & {
  /** When true, lists archived teams only. */
  includeArchived?: boolean;
};

/**
 * Path and React Query key for one GET /api/teams page. Keyed under
 * `['teams']` so team mutations invalidate every page.
 */
export function buildTeamsListRequest({
  includeArchived = false,
  limit,
  startKey,
}: TeamsListQueryArgs): ListRequest {
  return {
    path: listPath('/api/teams/', {includeArchived, limit, startKey}),
    queryKey: [
      'teams',
      includeArchived ? 'archived' : 'active',
      limit ?? null,
      startKey ?? null,
    ],
  };
}

/**
 * One page of teams the user can view, newest first. Read `data.teams` and
 * `data.nextStartKey`; omitting `limit` gets the API default page (50).
 */
export const useGetTeams = ({
  user,
  enabled = true,
  ...args
}: TeamsListQueryArgs & {
  user: User | null;
  enabled?: boolean;
}) => {
  const {path, queryKey} = buildTeamsListRequest(args);
  return useQuery({
    queryKey,
    queryFn: () => get<GetListTeamsResponse>(path, user),
    enabled: !!user && enabled,
  });
};

/** Cursor-paged teams for Control Centre tables (active, or the archive). */
export const usePagedTeams = ({
  user,
  enabled = true,
  includeArchived = false,
  defaultPageSize,
}: {
  user: User | null;
  enabled?: boolean;
  includeArchived?: boolean;
  defaultPageSize?: number;
}) => {
  const {items, ...paged} = usePagedList<GetListTeamsResponse, 'teams'>({
    user,
    enabled,
    scope: includeArchived ? 'archived' : 'active',
    defaultPageSize,
    buildRequest: page => buildTeamsListRequest({includeArchived, ...page}),
    itemsKey: 'teams',
  });
  return {...paged, teams: items};
};

/**
 * Active teams for pickers, newest first. `items` grows a page at a time;
 * Get more follows `nextStartKey`.
 */
export const useInfiniteTeams = ({
  user,
  enabled = true,
}: {
  user: User | null;
  enabled?: boolean;
}) =>
  useInfiniteList<GetListTeamsResponse, 'teams'>({
    user,
    enabled,
    buildRequest: buildTeamsListRequest,
    itemsKey: 'teams',
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
  visibility,
}: {
  user: User | null;
  enabled?: boolean;
  /** When true, lists only archived templates (requires includeArchived=true on the API). */
  includeArchived?: boolean;
  teamId?: string;
  limit?: number;
  startKey?: string;
  visibility?: 'public' | 'private';
}) => {
  const {path, queryKey} = buildTemplatesListRequest({
    teamId,
    includeArchived,
    limit,
    startKey,
    visibility,
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
  defaultPageSize,
  visibility,
}: {
  user: User | null;
  enabled?: boolean;
  includeArchived?: boolean;
  teamId?: string;
  defaultPageSize?: number;
  visibility?: 'public' | 'private';
}) => {
  const {items, ...paged} = usePagedList<GetListTemplatesResponse, 'templates'>(
    {
      user,
      enabled,
      scope: `${includeArchived ? 'archived' : 'active'}:${teamId ?? ''}:${visibility ?? 'all'}`,
      defaultPageSize,
      buildRequest: page => {
        const {path, queryKey} = buildTemplatesListRequest({
          teamId,
          includeArchived,
          visibility,
          ...page,
        });
        return {path, queryKey: [...queryKey, user?.token]};
      },
      itemsKey: 'templates',
    }
  );
  return {...paged, templates: items};
};

/** Create-survey picker page size; follow `nextStartKey` with Get more. */
export const TEMPLATE_PICKER_PAGE_SIZE = PICKER_PAGE_SIZE;

/**
 * Infinite template catalogue for selectors. Newest `createdAt` first; Get
 * more follows `nextStartKey`.
 */
export const useInfiniteTemplates = ({
  user,
  enabled = true,
  includeArchived = false,
  teamId,
}: {
  user: User | null;
  enabled?: boolean;
  includeArchived?: boolean;
  teamId?: string;
}) =>
  useInfiniteList<GetListTemplatesResponse, 'templates'>({
    user,
    enabled,
    pageSize: TEMPLATE_PICKER_PAGE_SIZE,
    buildRequest: page => {
      const {path, queryKey} = buildTemplatesListRequest({
        teamId,
        includeArchived,
        ...page,
      });
      return {path, queryKey: [...queryKey, user?.token]};
    },
    itemsKey: 'templates',
  });

/** Query fields for GET /api/users list requests. */
export type UsersListQueryArgs = ListPageArgs & {
  /** When true, lists disabled accounts only. */
  includeArchived?: boolean;
};

/**
 * Path and React Query key for one GET /api/users page. Keyed under
 * `['users']`.
 */
export function buildUsersListRequest({
  includeArchived = false,
  limit,
  startKey,
}: UsersListQueryArgs): ListRequest {
  return {
    path: listPath('/api/users', {includeArchived, limit, startKey}),
    queryKey: [
      'users',
      includeArchived ? 'disabled' : 'enabled',
      limit ?? null,
      startKey ?? null,
    ],
  };
}

/**
 * Cursor-paged user accounts in name order: enabled accounts, or disabled
 * ones only when `includeArchived` is true (the Archive tab).
 */
export const usePagedUsers = ({
  user,
  enabled = true,
  includeArchived = false,
  defaultPageSize,
}: {
  user: User | null;
  enabled?: boolean;
  includeArchived?: boolean;
  defaultPageSize?: number;
}) => {
  const {items, ...paged} = usePagedList<GetListAllUsersResponse, 'users'>({
    user,
    enabled,
    scope: includeArchived ? 'disabled' : 'enabled',
    defaultPageSize,
    buildRequest: page => buildUsersListRequest({includeArchived, ...page}),
    itemsKey: 'users',
  });
  return {...paged, users: items};
};

/** Invite row plus its registration link and a QR code for that link. */
export type InviteWithLink<T> = T & {url: string; qrCode: string};

/**
 * Fetches one invite page and adds each invite's registration URL and QR
 * code. QR rendering is the slow part, so it runs for the fetched page only.
 */
async function fetchInvitePage<T extends {_id: string}>({
  path,
  user,
  redirect,
}: {
  path: string;
  user: User | null;
  redirect: string;
}): Promise<{invites: InviteWithLink<T>[]; nextStartKey?: string}> {
  const page = await get<{invites: T[]; nextStartKey?: string}>(path, user);
  const invites = await Promise.all(
    page.invites.map(async invite => {
      const url = buildRegisterUrl({inviteId: invite._id, redirect});
      return {...invite, url, qrCode: await QRCode.toDataURL(url)};
    })
  );
  return {...page, invites};
}

type ProjectInvite = GetProjectInvitesResponse['invites'][number];
type TeamInvite = GetTeamInvitesResponse['invites'][number];
type GlobalInvite = GetGlobalInvitesResponse['invites'][number];

/**
 * Cursor-paged valid invites for a survey, newest first, each with its
 * registration link and QR code. Keyed under `['projectinvites', projectId]`.
 */
export const usePagedProjectInvites = ({
  user,
  redirect,
  projectId,
  defaultPageSize,
}: {
  user: User | null;
  projectId: string;
  redirect: string;
  defaultPageSize?: number;
}) => {
  const {items, ...paged} = usePagedList<
    {invites: InviteWithLink<ProjectInvite>[]; nextStartKey?: string},
    'invites'
  >({
    user,
    enabled: !!projectId,
    scope: projectId,
    defaultPageSize,
    buildRequest: ({limit, startKey}) => ({
      path: listPath(`/api/invites/notebook/${projectId}`, {limit, startKey}),
      queryKey: ['projectinvites', projectId, limit, startKey ?? null],
    }),
    itemsKey: 'invites',
    fetchPage: path => fetchInvitePage<ProjectInvite>({path, user, redirect}),
  });
  return {...paged, invites: items};
};

/**
 * Cursor-paged valid invites for a team, newest first, each with its
 * registration link and QR code. Keyed under `['teaminvites', teamId]`.
 */
export const usePagedTeamInvites = ({
  user,
  teamId,
  redirect,
  defaultPageSize,
}: {
  user: User | null;
  teamId: string;
  redirect: string;
  defaultPageSize?: number;
}) => {
  const {items, ...paged} = usePagedList<
    {invites: InviteWithLink<TeamInvite>[]; nextStartKey?: string},
    'invites'
  >({
    user,
    enabled: !!teamId,
    scope: teamId,
    defaultPageSize,
    buildRequest: ({limit, startKey}) => ({
      path: listPath(`/api/invites/team/${teamId}`, {limit, startKey}),
      queryKey: ['teaminvites', teamId, limit, startKey ?? null],
    }),
    itemsKey: 'invites',
    fetchPage: path => fetchInvitePage<TeamInvite>({path, user, redirect}),
  });
  return {...paged, invites: items};
};

/**
 * Cursor-paged valid global invites, newest first, each with its
 * registration link and QR code. Keyed under `['globalinvites']`.
 */
export const usePagedGlobalInvites = ({
  user,
  redirect,
  defaultPageSize,
}: {
  user: User | null;
  redirect: string;
  defaultPageSize?: number;
}) => {
  const {items, ...paged} = usePagedList<
    {invites: InviteWithLink<GlobalInvite>[]; nextStartKey?: string},
    'invites'
  >({
    user,
    scope: 'global',
    defaultPageSize,
    buildRequest: ({limit, startKey}) => ({
      path: listPath('/api/invites/global', {limit, startKey}),
      queryKey: ['globalinvites', limit, startKey ?? null],
    }),
    itemsKey: 'invites',
    fetchPage: path => fetchInvitePage<GlobalInvite>({path, user, redirect}),
  });
  return {...paged, invites: items};
};

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
 * Cursor-paged users holding a role on a survey, in name order. `data.roles`
 * (every survey role) comes with each page. Keyed under
 * `['projectusers', projectId]`.
 */
export const usePagedProjectUsers = ({
  projectId,
  user,
  defaultPageSize,
}: {
  user: User | null;
  projectId: string;
  defaultPageSize?: number;
}) => {
  const {items, ...paged} = usePagedList<GetNotebookUsersResponse, 'users'>({
    user,
    scope: projectId,
    defaultPageSize,
    buildRequest: ({limit, startKey}) => ({
      path: listPath(`/api/notebooks/${projectId}/users`, {limit, startKey}),
      queryKey: ['projectusers', projectId, limit, startKey ?? null],
    }),
    itemsKey: 'users',
  });
  return {...paged, users: items};
};

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
 * Cursor-paged long-lived tokens, newest first: the user's own, or every
 * user's when `fetchAll` is true (admins). `data.maxDurationDays` and
 * `data.maxAllowedExpiryTimestamp` come with each page. Keyed under
 * `['long-lived-tokens']`.
 */
export const usePagedLongLivedTokens = ({
  user,
  fetchAll,
  defaultPageSize,
}: {
  user: User;
  fetchAll: boolean;
  defaultPageSize?: number;
}) => {
  const {items, ...paged} = usePagedList<GetLongLivedTokensResponse, 'tokens'>({
    user,
    scope: fetchAll ? 'all' : 'mine',
    defaultPageSize,
    buildRequest: ({limit, startKey}) => ({
      path: listPath('/api/long-lived-tokens', {
        all: fetchAll ? 'true' : undefined,
        limit,
        startKey,
      }),
      queryKey: [
        'long-lived-tokens',
        user.user.id,
        fetchAll,
        limit,
        startKey ?? null,
      ],
    }),
    itemsKey: 'tokens',
  });
  return {...paged, tokens: items};
};

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

/**
 * Build `/api/admin/stats/teams` or `/people` with pagination query params.
 * Lists always read the cached snapshot; Refresh uses POST `/refresh`.
 */
function adminStatsListPath(
  path: '/api/admin/stats/teams' | '/api/admin/stats/people',
  {limit, offset}: {limit: number; offset: number}
) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  return `${path}?${params.toString()}`;
}

/** Keep unused snapshots in memory after leaving /stats so a quick return is free. */
const ADMIN_STATS_GC_MS = 10 * 60 * 1000;

/**
 * Milliseconds until the API snapshot TTL (`expiresAt`) elapses.
 * Used as React Query `staleTime` so a recent visit does not refetch.
 */
function adminStatsRemainingMs(expiresAt?: string): number {
  if (!expiresAt) return 0;
  const remaining = Date.parse(expiresAt) - Date.now();
  return Number.isFinite(remaining) ? Math.max(0, remaining) : 0;
}

const adminStatsQueryCache = {
  staleTime: (query: {state: {data?: {expiresAt?: string}}}) =>
    adminStatsRemainingMs(query.state.data?.expiresAt),
  refetchInterval: (query: {state: {data?: {expiresAt?: string}}}) => {
    const remaining = adminStatsRemainingMs(query.state.data?.expiresAt);
    return remaining > 0 ? remaining : false;
  },
  gcTime: ADMIN_STATS_GC_MS,
};

/**
 * Overall admin stats (`GET /api/admin/stats`). Fetches on landing; React Query
 * keeps the snapshot fresh until `expiresAt`, then GET again. Refresh POSTs.
 *
 * @param user - Authenticated Control Centre user
 * @param enabled - When false, the query does not run
 */
export const useGetAdminStats = ({
  user,
  enabled = true,
}: {
  user: User | null;
  enabled?: boolean;
}) =>
  useQuery({
    queryKey: ['admin-stats', user?.token],
    queryFn: () => get<GetAdminStatsResponse>('/api/admin/stats', user),
    enabled: !!user && enabled,
    ...adminStatsQueryCache,
  });

/**
 * Paginated per-team admin stats from the same snapshot as overall counts.
 *
 * @param user - Authenticated Control Centre user
 * @param enabled - When false, the query does not run
 * @param limit - Page size forwarded to the API
 * @param offset - Page offset forwarded to the API
 */
export const useGetAdminStatsTeams = ({
  user,
  enabled = true,
  limit,
  offset,
}: {
  user: User | null;
  enabled?: boolean;
  limit: number;
  offset: number;
}) =>
  useQuery({
    queryKey: ['admin-stats-teams', user?.token, limit, offset],
    queryFn: () =>
      get<GetAdminStatsTeamsResponse>(
        adminStatsListPath('/api/admin/stats/teams', {limit, offset}),
        user
      ),
    enabled: !!user && enabled,
    placeholderData: keepPreviousData,
    ...adminStatsQueryCache,
  });

/**
 * Paginated per-person admin stats from the same snapshot as overall counts.
 * People rows are keyed by record/attachment `created_by`.
 *
 * @param user - Authenticated Control Centre user
 * @param enabled - When false, the query does not run
 * @param limit - Page size forwarded to the API
 * @param offset - Page offset forwarded to the API
 */
export const useGetAdminStatsPeople = ({
  user,
  enabled = true,
  limit,
  offset,
}: {
  user: User | null;
  enabled?: boolean;
  limit: number;
  offset: number;
}) =>
  useQuery({
    queryKey: ['admin-stats-people', user?.token, limit, offset],
    queryFn: () =>
      get<GetAdminStatsPeopleResponse>(
        adminStatsListPath('/api/admin/stats/people', {limit, offset}),
        user
      ),
    enabled: !!user && enabled,
    placeholderData: keepPreviousData,
    ...adminStatsQueryCache,
  });

/**
 * Recompute the admin stats snapshot once (`POST /api/admin/stats/refresh`),
 * then update overall counts and refetch paged teams/people from the new cache.
 */
export const useRefreshAdminStats = ({user}: {user: User | null}) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      return await post<Record<string, never>, GetAdminStatsResponse>({
        path: '/api/admin/stats/refresh',
        data: {},
        user,
      });
    },
    onSuccess: data => {
      queryClient.setQueryData(['admin-stats', user?.token], data);
      queryClient.invalidateQueries({queryKey: ['admin-stats-teams']});
      queryClient.invalidateQueries({queryKey: ['admin-stats-people']});
    },
  });
};
