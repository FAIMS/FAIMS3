// SPDX-License-Identifier: Apache-2.0
import {config} from '@/constants';
import {User} from '@/context/auth-provider';
import {
  MAP_ASSET_UPLOAD_BUSY_MESSAGE,
  isMapAssetInProgress,
  mapAssetKindLabel,
  mapAssetProcessingStatusText,
  mapAssetSnapshotMs,
  type ExistingMapAsset,
  type GetMapAssetListResponse,
  type GetMapAssetResponse,
} from '@faims3/data-model';
import {
  keepPreviousData,
  useQueries,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import {
  listPath,
  pagedListControls,
  useListCursor,
  type ListPageArgs,
} from './paged-list';
import {errorMessageFromNotebookJsonBody} from './project-hooks';

/** How often in-progress layers are polled via GET /api/map-assets/:id. */
const MAP_ASSET_PROGRESS_POLL_MS = 2000;

/**
 * List rows are patched from the in-progress poll. A short stale window
 * avoids a full list refetch on every window focus (file picker, alt-tab),
 * which remounted open create/replace dialogs.
 */
const MAP_ASSET_LIST_STALE_MS = 60_000;

/**
 * Stable cache identity for one Control Centre session. The JWT rotates
 * every few minutes; putting it in the query key made every map-layer
 * query look new (`isPending`), which swapped pages for skeletons and
 * closed dialogs.
 */
export function mapAssetQueryUserKey(user: User | null): string | undefined {
  return user?.user?.id ?? user?.decodedToken?.username ?? user?.token;
}

/**
 * React Query key prefix for the library or one survey's linked layers.
 * Every page of that list is keyed under it (see {@link mapAssetListPageKey}).
 */
export const mapAssetQueryKey = (user: User | null, projectId?: string) => [
  'map-assets',
  mapAssetQueryUserKey(user),
  projectId ?? 'library',
];

/** React Query key prefix for layers owned by one team. */
export const mapAssetTeamQueryKey = (user: User | null, teamId: string) => [
  'map-assets',
  mapAssetQueryUserKey(user),
  'team',
  teamId,
];

/** Which map-layer list a request reads. */
export type MapAssetListScope = {
  /** Layers linked to this survey. */
  projectId?: string;
  /** Layers owned by this team. */
  teamId?: string;
  /** Library layers that are ready and not yet linked to this survey. */
  linkableToProjectId?: string;
};

/** Marks the paging part of a list key; the cursor follows two places on. */
const LIST_PAGE_MARKER = 'page';

/**
 * React Query key for one page of a map-layer list: the list's prefix, then
 * `'page'`, the page size and the cursor (`null` on the first page). The
 * `linkableToProjectId` list sits under the library prefix so a new layer
 * and progress polls reach it too.
 */
export function mapAssetListPageKey(
  user: User | null,
  {projectId, teamId, linkableToProjectId}: MapAssetListScope,
  {limit, startKey}: ListPageArgs = {}
): unknown[] {
  const root = teamId
    ? mapAssetTeamQueryKey(user, teamId)
    : [
        ...mapAssetQueryKey(user, projectId),
        ...(!projectId && linkableToProjectId
          ? ['linkable', linkableToProjectId]
          : []),
      ];
  return [...root, LIST_PAGE_MARKER, limit ?? null, startKey ?? null];
}

/**
 * True when a list key is a first page (or carries no paging part). A new
 * layer is the newest, so it belongs at the top of first pages only.
 */
function isFirstMapAssetListPage(queryKey: readonly unknown[]): boolean {
  const marker = queryKey.indexOf(LIST_PAGE_MARKER, 3);
  return marker < 0 || (queryKey[marker + 2] ?? null) === null;
}

/** React Query key for one layer's details. */
export const mapAssetDetailQueryKey = (user: User | null, assetId: string) => [
  'map-assets',
  mapAssetQueryUserKey(user),
  'asset',
  assetId,
];

/** True for library / survey / team list keys, not details or links. */
function isMapAssetListQueryKey(queryKey: readonly unknown[]): boolean {
  const kind = queryKey[2];
  return kind !== 'asset' && kind !== 'links';
}

/** Ensure a list/detail row has a numeric linked-survey count. */
function withLinkCount(
  asset: ExistingMapAsset & {linkCount?: number},
  fallback = 0
): GetMapAssetResponse {
  return {
    ...asset,
    linkCount: asset.linkCount ?? fallback,
  };
}

/** Replace one layer in a list payload, or return `old` when it is absent. */
export function replaceAssetInList(
  old: GetMapAssetListResponse | undefined,
  asset: ExistingMapAsset & {linkCount?: number}
): GetMapAssetListResponse | undefined {
  if (!old?.assets) {
    return old;
  }
  const index = old.assets.findIndex(item => item._id === asset._id);
  if (index < 0 || old.assets[index] === asset) {
    return old;
  }
  const previous = old.assets[index];
  const next = withLinkCount(asset, previous.linkCount);
  if (previous === next) {
    return old;
  }
  const assets = [...old.assets];
  assets[index] = next;
  return {...old, assets};
}

/**
 * Insert a newly created layer, or replace it when this snapshot is newer.
 * Leaves `old` unchanged when the cached row is already newer.
 */
export function upsertAssetInList(
  old: GetMapAssetListResponse | undefined,
  asset: ExistingMapAsset & {linkCount?: number}
): GetMapAssetListResponse | undefined {
  if (!old?.assets) {
    return old;
  }
  const index = old.assets.findIndex(item => item._id === asset._id);
  if (index < 0) {
    // Keep `nextStartKey`: the page still has the same rows after it.
    return {
      ...old,
      assets: [withLinkCount(asset), ...old.assets],
    };
  }
  const current = old.assets[index];
  if (
    current === asset ||
    mapAssetSnapshotMs(current) > mapAssetSnapshotMs(asset)
  ) {
    return old;
  }
  const assets = [...old.assets];
  assets[index] = withLinkCount(asset, current.linkCount);
  return {...old, assets};
}

/**
 * Library list, or the team list that owns this layer. Not survey lists,
 * and not a "linkable" list: a new layer is not ready to link.
 */
function isListForCreatedAsset(
  queryKey: readonly unknown[],
  asset: ExistingMapAsset
): boolean {
  const kind = queryKey[2];
  if (kind === 'library') {
    return queryKey[3] !== 'linkable';
  }
  if (kind === 'team') {
    return queryKey[3] === asset.ownedByTeamId;
  }
  return false;
}

/** Ids still waiting on a spatial worker. */
export function inProgressMapAssetIds(assets: ExistingMapAsset[]): string[] {
  return assets
    .filter(asset => isMapAssetInProgress(asset.status))
    .map(asset => asset._id);
}

/**
 * Copy list rows into per-asset detail queries. A newer polled snapshot is
 * left in place so a later list fetch cannot roll progress backwards.
 * `linkCount` is computed at read time and is not on `updatedAt`, so a
 * kept snapshot still takes the list row's count.
 */
export function seedMapAssetDetailsFromList(
  queryClient: QueryClient,
  user: User,
  assets: Array<ExistingMapAsset & {linkCount?: number}>
): void {
  for (const asset of assets) {
    const key = mapAssetDetailQueryKey(user, asset._id);
    const existing = queryClient.getQueryData<
      ExistingMapAsset & {linkCount?: number}
    >(key);
    if (existing && mapAssetSnapshotMs(existing) >= mapAssetSnapshotMs(asset)) {
      if (
        asset.linkCount !== undefined &&
        existing.linkCount !== asset.linkCount
      ) {
        queryClient.setQueryData(key, {
          ...existing,
          linkCount: asset.linkCount,
        });
      }
      continue;
    }
    queryClient.setQueryData(key, asset);
  }
}

/**
 * Prefer a newer cached details snapshot over the list row. Always take
 * `linkCount` from the list: linking does not bump `updatedAt`, so a
 * cached seed would otherwise hide the new count.
 */
export function overlayListWithCachedMapAssets(
  queryClient: QueryClient,
  user: User,
  data: GetMapAssetListResponse
): GetMapAssetListResponse {
  const assets = data.assets.map(asset => {
    const cached = queryClient.getQueryData<GetMapAssetResponse>(
      mapAssetDetailQueryKey(user, asset._id)
    );
    return cached && mapAssetSnapshotMs(cached) >= mapAssetSnapshotMs(asset)
      ? {...cached, linkCount: asset.linkCount}
      : asset;
  });
  const unchanged = assets.every(
    (asset, index) => asset === data.assets[index]
  );
  return unchanged ? data : {...data, assets};
}

/** Write a details poll into every list cache that already contains the layer. */
export function patchMapAssetInLists(
  queryClient: QueryClient,
  user: User,
  asset: ExistingMapAsset
): void {
  queryClient.setQueriesData<GetMapAssetListResponse>(
    {
      predicate: query =>
        query.queryKey[0] === 'map-assets' &&
        query.queryKey[1] === mapAssetQueryUserKey(user) &&
        isMapAssetListQueryKey(query.queryKey),
    },
    old => replaceAssetInList(old, asset)
  );
}

/** Pull a user-facing message from a JSON error body, else `statusText`. */
export function messageFromBody(body: unknown, statusText: string): string {
  const fromObject = errorMessageFromNotebookJsonBody(body, '');
  if (fromObject) {
    return fromObject;
  }
  if (Array.isArray(body)) {
    const issue = (
      body[0] as {errors?: {issues?: {message?: string}[]}} | undefined
    )?.errors?.issues?.[0]?.message;
    if (issue) {
      return issue;
    }
  }
  return statusText;
}

/** Map an upload HTTP status + parsed body to the toast / Error message. */
export function mapAssetClientErrorMessage({
  status,
  body,
  statusText,
}: {
  status: number;
  body: unknown;
  statusText: string;
}): string {
  if (status === 503) {
    return MAP_ASSET_UPLOAD_BUSY_MESSAGE;
  }
  return messageFromBody(body, statusText);
}

/** User-facing message from a failed JSON response. */
async function errorMessage(response: Response): Promise<string> {
  try {
    return messageFromBody(await response.json(), response.statusText);
  } catch {
    return response.statusText;
  }
}

/**
 * POST/PUT multipart upload with XHR so `onProgress` can report 0–1
 * completion. Maps non-2xx bodies through {@link mapAssetClientErrorMessage}.
 */
function sendFormData({
  url,
  method,
  token,
  body,
  onProgress,
}: {
  url: string;
  method: 'POST' | 'PUT';
  token: string;
  body: FormData;
  onProgress?: (completion: number) => void;
}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = event => {
      if (!onProgress || !event.lengthComputable || event.total <= 0) {
        return;
      }
      onProgress(Math.min(1, event.loaded / event.total));
    };
    xhr.onload = () => {
      let json: unknown;
      try {
        json = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
      } catch {
        json = undefined;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(
          new Error(
            mapAssetClientErrorMessage({
              status: xhr.status,
              body: json,
              statusText: xhr.statusText,
            })
          )
        );
        return;
      }
      onProgress?.(1);
      resolve(json);
    };
    xhr.onerror = () => reject(new Error('Upload failed.'));
    xhr.send(body);
  });
}

/**
 * GET one page of /api/map-assets, optionally filtered by survey or team.
 * Without `limit` the API returns its default page, never the whole list.
 */
export async function fetchMapAssets({
  user,
  projectId,
  teamId,
  linkableToProjectId,
  limit,
  startKey,
}: {
  user: User;
} & MapAssetListScope &
  ListPageArgs): Promise<GetMapAssetListResponse> {
  const response = await fetch(
    `${config.apiUrl}${listPath('/api/map-assets', {
      projectId,
      teamId,
      linkableToProjectId,
      limit,
      startKey,
    })}`,
    {
      headers: {Authorization: `Bearer ${user.token}`},
      cache: 'no-store',
    }
  );
  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }
  return (await response.json()) as GetMapAssetListResponse;
}

/** GET one page of /api/teams/:teamId/map-assets. */
export async function fetchTeamMapAssets({
  user,
  teamId,
  limit,
  startKey,
}: {
  user: User;
  teamId: string;
} & ListPageArgs): Promise<GetMapAssetListResponse> {
  const response = await fetch(
    `${config.apiUrl}${listPath(
      `/api/teams/${encodeURIComponent(teamId)}/map-assets`,
      {limit, startKey}
    )}`,
    {
      headers: {Authorization: `Bearer ${user.token}`},
      cache: 'no-store',
    }
  );
  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }
  return (await response.json()) as GetMapAssetListResponse;
}

/** Shared GET /api/map-assets/:id query; polls only while the job is live. */
function mapAssetDetailQueryOptions({
  queryClient,
  user,
  assetId,
  enabled,
}: {
  queryClient: QueryClient;
  user: User | null;
  assetId: string;
  enabled: boolean;
}) {
  return {
    queryKey: mapAssetDetailQueryKey(user, assetId),
    enabled: enabled && !!user && assetId.length > 0,
    queryFn: async () => {
      const asset = await fetchMapAsset({user: user as User, assetId});
      patchMapAssetInLists(queryClient, user as User, asset);
      return asset;
    },
    staleTime: (query: {state: {data?: ExistingMapAsset}}) =>
      query.state.data && !isMapAssetInProgress(query.state.data.status)
        ? Infinity
        : 0,
    refetchInterval: (query: {state: {data?: ExistingMapAsset}}) =>
      query.state.data && isMapAssetInProgress(query.state.data.status)
        ? MAP_ASSET_PROGRESS_POLL_MS
        : false,
    placeholderData: keepPreviousData,
  };
}

/**
 * One page of layers for the library, a survey, or a team, newest first.
 *
 * Fetches the page once (plus invalidation). Ready rows stay in that
 * snapshot and in per-asset detail queries. In-progress layers on the page
 * are refreshed via GET /api/map-assets/:id and patched back into it.
 * Window-focus refetch is off so a file picker or alt-tab does not remount
 * open dialogs.
 */
export function useMapAssets({
  user,
  projectId,
  teamId,
  linkableToProjectId,
  limit,
  startKey,
  enabled = true,
}: {
  user: User | null;
  enabled?: boolean;
} & MapAssetListScope &
  ListPageArgs) {
  const queryClient = useQueryClient();
  const listQuery = useQuery({
    queryKey: mapAssetListPageKey(
      user,
      {projectId, teamId, linkableToProjectId},
      {limit, startKey}
    ),
    enabled: !!user && enabled,
    staleTime: MAP_ASSET_LIST_STALE_MS,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const data = teamId
        ? await fetchTeamMapAssets({
            user: user as User,
            teamId,
            limit,
            startKey,
          })
        : await fetchMapAssets({
            user: user as User,
            projectId,
            linkableToProjectId,
            limit,
            startKey,
          });
      seedMapAssetDetailsFromList(queryClient, user as User, data.assets);
      return overlayListWithCachedMapAssets(queryClient, user as User, data);
    },
  });

  const inProgressIds = inProgressMapAssetIds(listQuery.data?.assets ?? []);
  useQueries({
    queries: inProgressIds.map(assetId =>
      mapAssetDetailQueryOptions({
        queryClient,
        user,
        assetId,
        enabled: !!user && enabled,
      })
    ),
  });

  return listQuery;
}

/**
 * {@link useMapAssets} for a table: holds the page size and cursor, and
 * returns the page's `assets` plus `serverPagination` for `<DataTable>`.
 */
export function usePagedMapAssets({
  user,
  projectId,
  teamId,
  linkableToProjectId,
  enabled = true,
  defaultPageSize,
}: {
  user: User | null;
  enabled?: boolean;
  defaultPageSize?: number;
} & MapAssetListScope) {
  const cursor = useListCursor({
    scope: JSON.stringify([projectId, teamId, linkableToProjectId]),
    defaultPageSize,
  });
  const query = useMapAssets({
    user,
    projectId,
    teamId,
    linkableToProjectId,
    enabled,
    limit: cursor.pageSize,
    startKey: cursor.startKey,
  });
  const controls = pagedListControls(cursor, query);
  return {
    ...query,
    assets: query.data?.assets,
    ...controls,
    // Not `isFetching`: the in-progress poll must not blank the table, and
    // `isPlaceholderData` already covers a page change.
    tableLoading: query.isPending || query.isPlaceholderData,
  };
}

/** GET /api/map-assets/:assetId. */
export async function fetchMapAsset({
  user,
  assetId,
}: {
  user: User;
  assetId: string;
}): Promise<GetMapAssetResponse> {
  const response = await fetch(`${config.apiUrl}/api/map-assets/${assetId}`, {
    headers: {Authorization: `Bearer ${user.token}`},
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }
  return (await response.json()) as GetMapAssetResponse;
}

/** One layer; polls every 2s while status is pending or processing. */
export function useMapAsset({
  user,
  assetId,
}: {
  user: User | null;
  assetId: string;
}) {
  const queryClient = useQueryClient();
  return useQuery(
    mapAssetDetailQueryOptions({
      queryClient,
      user,
      assetId,
      enabled: true,
    })
  );
}

/** PATCH name and description. */
export async function updateMapAssetDetails({
  user,
  assetId,
  name,
  description,
}: {
  user: User;
  assetId: string;
  name: string;
  description: string;
}): Promise<GetMapAssetResponse> {
  const response = await fetch(`${config.apiUrl}/api/map-assets/${assetId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${user.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({name, description}),
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }
  return (await response.json()) as GetMapAssetResponse;
}

/** PUT replacement files and restart processing. */
export async function replaceMapAssetFiles({
  user,
  assetId,
  files,
  onProgress,
}: {
  user: User;
  assetId: string;
  files: File[];
  onProgress?: (completion: number) => void;
}): Promise<GetMapAssetResponse> {
  const body = new FormData();
  for (const file of files) {
    body.append('files', file);
  }
  const json = await sendFormData({
    url: `${config.apiUrl}/api/map-assets/${assetId}`,
    method: 'PUT',
    token: user.token,
    body,
    onProgress,
  });
  return json as GetMapAssetResponse;
}

/** Invalidate library, team, and optional single-asset map-layer queries. */
export async function invalidateMapAssets(
  queryClient: QueryClient,
  user: User,
  assetId?: string
): Promise<void> {
  const pending = [
    queryClient.invalidateQueries({
      queryKey: ['map-assets', mapAssetQueryUserKey(user)],
    }),
  ];
  if (assetId) {
    pending.push(
      queryClient.invalidateQueries({
        queryKey: mapAssetDetailQueryKey(user, assetId),
      })
    );
  }
  await Promise.all(pending);
}

/**
 * Put a just-created layer in the library/team list cache and its detail
 * query so polling starts before the list refetch returns.
 */
export function cacheCreatedMapAsset(
  queryClient: QueryClient,
  user: User,
  asset: ExistingMapAsset
): void {
  queryClient.setQueryData(mapAssetDetailQueryKey(user, asset._id), asset);
  queryClient.setQueriesData<GetMapAssetListResponse>(
    {
      predicate: query =>
        query.queryKey[0] === 'map-assets' &&
        query.queryKey[1] === mapAssetQueryUserKey(user) &&
        isMapAssetListQueryKey(query.queryKey) &&
        isFirstMapAssetListPage(query.queryKey) &&
        isListForCreatedAsset(query.queryKey, asset),
    },
    old => upsertAssetInList(old, asset)
  );
}

/**
 * Seed the created layer, invalidate list fetches, then seed again if
 * the refetch raced the Couch view and omitted the new row.
 */
export async function invalidateMapAssetsAfterCreate(
  queryClient: QueryClient,
  user: User,
  asset: ExistingMapAsset
): Promise<void> {
  cacheCreatedMapAsset(queryClient, user, asset);
  await queryClient.invalidateQueries({
    predicate: query =>
      query.queryKey[0] === 'map-assets' &&
      query.queryKey[1] === mapAssetQueryUserKey(user) &&
      isMapAssetListQueryKey(query.queryKey),
    refetchType: 'all',
  });
  cacheCreatedMapAsset(queryClient, user, asset);
}

/** GET survey ids linked to this layer. */
export async function fetchMapAssetLinks({
  user,
  assetId,
}: {
  user: User;
  assetId: string;
}): Promise<string[]> {
  const response = await fetch(
    `${config.apiUrl}/api/map-assets/${assetId}/links`,
    {headers: {Authorization: `Bearer ${user.token}`}}
  );
  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }
  const body = (await response.json()) as {projectIds: string[]};
  return body.projectIds ?? [];
}

/** Linked survey ids for one layer. */
export function useMapAssetLinks({
  user,
  assetId,
  enabled = true,
}: {
  user: User | null;
  assetId: string;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ['map-assets', mapAssetQueryUserKey(user), 'links', assetId],
    enabled: !!user && assetId.length > 0 && enabled,
    queryFn: () => fetchMapAssetLinks({user: user as User, assetId}),
  });
}

/** POST a new layer (files + details) with upload progress. */
export async function uploadMapAsset({
  user,
  name,
  description,
  teamId,
  files,
  onProgress,
}: {
  user: User;
  name: string;
  description: string;
  teamId?: string;
  files: File[];
  onProgress?: (completion: number) => void;
}): Promise<GetMapAssetResponse> {
  const body = new FormData();
  body.set('name', name);
  body.set('description', description);
  if (teamId) {
    body.set('teamId', teamId);
  }
  for (const file of files) {
    body.append('files', file);
  }
  const json = await sendFormData({
    url: `${config.apiUrl}/api/map-assets`,
    method: 'POST',
    token: user.token,
    body,
    onProgress,
  });
  return json as GetMapAssetResponse;
}

/** DELETE /api/map-assets/:assetId. */
export async function deleteMapAsset({
  user,
  assetId,
}: {
  user: User;
  assetId: string;
}): Promise<void> {
  const response = await fetch(`${config.apiUrl}/api/map-assets/${assetId}`, {
    method: 'DELETE',
    headers: {Authorization: `Bearer ${user.token}`},
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }
}

/** POST a layer–survey link. */
export async function linkMapAsset({
  user,
  assetId,
  projectId,
}: {
  user: User;
  assetId: string;
  projectId: string;
}): Promise<void> {
  const response = await fetch(
    `${config.apiUrl}/api/map-assets/${assetId}/links`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${user.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({projectId}),
    }
  );
  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }
}

/** DELETE a layer–survey link. */
export async function unlinkMapAsset({
  user,
  assetId,
  projectId,
}: {
  user: User;
  assetId: string;
  projectId: string;
}): Promise<void> {
  const response = await fetch(
    `${config.apiUrl}/api/map-assets/${assetId}/links/${projectId}`,
    {
      method: 'DELETE',
      headers: {Authorization: `Bearer ${user.token}`},
    }
  );
  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }
}

/** Status, progress, or kind label for compact UI (toasts, badges). */
export function formatAssetStatus(asset: ExistingMapAsset): string {
  if (asset.status === 'failed') {
    return asset.failureReason ?? 'Failed';
  }
  if (isMapAssetInProgress(asset.status)) {
    return (
      mapAssetProcessingStatusText(asset) ??
      (asset.status === 'pending' ? 'Pending' : 'Processing')
    );
  }
  return mapAssetKindLabel(asset.kind) || 'Vector';
}
