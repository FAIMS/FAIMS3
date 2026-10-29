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
  useQueries,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import {errorMessageFromNotebookJsonBody} from './project-hooks';

/** How often in-progress layers are polled via GET /api/map-assets/:id. */
const MAP_ASSET_PROGRESS_POLL_MS = 2000;

/** React Query key for the library or one survey's linked layers. */
export const mapAssetQueryKey = (user: User | null, projectId?: string) => [
  'map-assets',
  user?.token,
  projectId ?? 'library',
];

/** React Query key for layers owned by one team. */
export const mapAssetTeamQueryKey = (user: User | null, teamId: string) => [
  'map-assets',
  user?.token,
  'team',
  teamId,
];

/** React Query key for one layer's details. */
export const mapAssetDetailQueryKey = (user: User | null, assetId: string) => [
  'map-assets',
  user?.token,
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
    return {
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

/** Library list, or the team list that owns this layer. Not survey lists. */
function isListForCreatedAsset(
  queryKey: readonly unknown[],
  asset: ExistingMapAsset
): boolean {
  const kind = queryKey[2];
  if (kind === 'library') {
    return true;
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
 */
export function seedMapAssetDetailsFromList(
  queryClient: QueryClient,
  user: User,
  assets: ExistingMapAsset[]
): void {
  for (const asset of assets) {
    const key = mapAssetDetailQueryKey(user, asset._id);
    const existing = queryClient.getQueryData<ExistingMapAsset>(key);
    if (existing && mapAssetSnapshotMs(existing) >= mapAssetSnapshotMs(asset)) {
      continue;
    }
    queryClient.setQueryData(key, asset);
  }
}

/** Prefer a newer cached details snapshot over the list row. */
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
      ? withLinkCount(cached, asset.linkCount)
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
        query.queryKey[1] === user.token &&
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

/** GET /api/map-assets, optionally filtered by survey or team. */
export async function fetchMapAssets({
  user,
  projectId,
  teamId,
}: {
  user: User;
  projectId?: string;
  teamId?: string;
}): Promise<GetMapAssetListResponse> {
  const params = new URLSearchParams();
  if (projectId) {
    params.set('projectId', projectId);
  }
  if (teamId) {
    params.set('teamId', teamId);
  }
  const query = params.toString();
  const response = await fetch(
    `${config.apiUrl}/api/map-assets${query ? `?${query}` : ''}`,
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

/** GET /api/teams/:teamId/map-assets. */
export async function fetchTeamMapAssets({
  user,
  teamId,
}: {
  user: User;
  teamId: string;
}): Promise<GetMapAssetListResponse> {
  const response = await fetch(
    `${config.apiUrl}/api/teams/${encodeURIComponent(teamId)}/map-assets`,
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
  };
}

/**
 * List layers for the library, a survey, or a team.
 *
 * Fetches the list once (plus invalidation / window focus). Ready rows stay
 * in that snapshot and in per-asset detail queries. In-progress layers are
 * refreshed via GET /api/map-assets/:id and patched back into the list.
 */
export function useMapAssets({
  user,
  projectId,
  teamId,
  enabled = true,
}: {
  user: User | null;
  projectId?: string;
  teamId?: string;
  enabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const listQuery = useQuery({
    queryKey: teamId
      ? mapAssetTeamQueryKey(user, teamId)
      : mapAssetQueryKey(user, projectId),
    enabled: !!user && enabled,
    queryFn: async () => {
      const data = teamId
        ? await fetchTeamMapAssets({user: user as User, teamId})
        : await fetchMapAssets({user: user as User, projectId});
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
    queryClient.invalidateQueries({queryKey: ['map-assets', user.token]}),
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
        query.queryKey[1] === user.token &&
        isMapAssetListQueryKey(query.queryKey) &&
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
      query.queryKey[1] === user.token &&
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
    queryKey: ['map-assets', user?.token, 'links', assetId],
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
