// SPDX-License-Identifier: Apache-2.0
import {config} from '@/constants';
import {User} from '@/context/auth-provider';
import {
  MAP_ASSET_UPLOAD_BUSY_MESSAGE,
  mapAssetKindLabel,
  type ExistingMapAsset,
  type GetMapAssetListResponse,
  type GetMapAssetResponse,
  type MapAssetNormalizeOptionsInput,
  type PostMapAssetEstimateInput,
  type PostMapAssetEstimateResponse,
} from '@faims3/data-model';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

export const mapAssetQueryKey = (user: User | null, projectId?: string) => [
  'map-assets',
  user?.token,
  projectId ?? 'library',
];

function messageFromBody(body: unknown, statusText: string): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const message = (body as {error?: {message?: string}}).error?.message;
    if (message) {
      return message;
    }
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

async function errorMessage(response: Response): Promise<string> {
  try {
    return messageFromBody(await response.json(), response.statusText);
  } catch {
    return response.statusText;
  }
}

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
            xhr.status === 503
              ? MAP_ASSET_UPLOAD_BUSY_MESSAGE
              : messageFromBody(json, xhr.statusText)
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
    {headers: {Authorization: `Bearer ${user.token}`}}
  );
  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }
  return (await response.json()) as GetMapAssetListResponse;
}

export function useMapAssets({
  user,
  projectId,
}: {
  user: User | null;
  projectId?: string;
}) {
  return useQuery({
    queryKey: mapAssetQueryKey(user, projectId),
    enabled: !!user,
    queryFn: () => fetchMapAssets({user: user as User, projectId}),
    refetchInterval: query => {
      const assets = query.state.data?.assets ?? [];
      return assets.some(asset => asset.status === 'processing') ? 2000 : false;
    },
  });
}

export async function fetchMapAsset({
  user,
  assetId,
}: {
  user: User;
  assetId: string;
}): Promise<GetMapAssetResponse> {
  const response = await fetch(`${config.apiUrl}/api/map-assets/${assetId}`, {
    headers: {Authorization: `Bearer ${user.token}`},
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }
  return (await response.json()) as GetMapAssetResponse;
}

export function useMapAsset({
  user,
  assetId,
}: {
  user: User | null;
  assetId: string;
}) {
  return useQuery({
    queryKey: ['map-assets', user?.token, 'asset', assetId],
    enabled: !!user && assetId.length > 0,
    queryFn: () => fetchMapAsset({user: user as User, assetId}),
    refetchInterval: query =>
      query.state.data?.status === 'processing' ? 2000 : false,
  });
}

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

export async function estimateMapAsset({
  user,
  input,
}: {
  user: User;
  input: PostMapAssetEstimateInput;
}): Promise<PostMapAssetEstimateResponse> {
  const response = await fetch(`${config.apiUrl}/api/map-assets/estimate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${user.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }
  return (await response.json()) as PostMapAssetEstimateResponse;
}

export async function replaceMapAssetFiles({
  user,
  assetId,
  files,
  quality,
  normalizeOptions,
  onProgress,
}: {
  user: User;
  assetId: string;
  files: File[];
  quality?: number;
  normalizeOptions?: MapAssetNormalizeOptionsInput;
  onProgress?: (completion: number) => void;
}): Promise<GetMapAssetResponse> {
  const body = new FormData();
  if (quality !== undefined) {
    body.set('quality', String(quality));
  }
  if (normalizeOptions) {
    body.set('normalizeOptions', JSON.stringify(normalizeOptions));
  }
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

export function invalidateMapAssets(
  queryClient: QueryClient,
  user: User,
  assetId?: string
) {
  void queryClient.invalidateQueries({queryKey: ['map-assets', user.token]});
  if (assetId) {
    void queryClient.invalidateQueries({
      queryKey: ['map-assets', user.token, 'asset', assetId],
    });
  }
}

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
  const body = (await response.json()) as {projectIds?: string[]};
  return body.projectIds ?? [];
}

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

export async function uploadMapAsset({
  user,
  name,
  description,
  teamId,
  files,
  quality,
  normalizeOptions,
  onProgress,
}: {
  user: User;
  name: string;
  description: string;
  teamId?: string;
  files: File[];
  quality?: number;
  normalizeOptions?: MapAssetNormalizeOptionsInput;
  onProgress?: (completion: number) => void;
}): Promise<GetMapAssetResponse> {
  const body = new FormData();
  body.set('name', name);
  body.set('description', description);
  if (teamId) {
    body.set('teamId', teamId);
  }
  if (quality !== undefined) {
    body.set('quality', String(quality));
  }
  if (normalizeOptions) {
    body.set('normalizeOptions', JSON.stringify(normalizeOptions));
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

export function useUploadMapAsset(user: User) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadMapAsset,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['map-assets', user.token],
      });
    },
  });
}

export function formatAssetStatus(asset: ExistingMapAsset): string {
  if (asset.status === 'failed') {
    return asset.failureReason ?? 'Failed';
  }
  if (asset.status === 'processing') {
    return 'Processing';
  }
  return mapAssetKindLabel(asset.kind) || 'Vector';
}
