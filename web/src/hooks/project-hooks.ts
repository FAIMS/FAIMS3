import {User} from '@/context/auth-provider';
import {readFileAsText} from '@/lib/utils';
import {
  prepareNotebookUiSpecificationInputForApi,
  type OfflineMapRegion,
  type ProjectStatus,
  type PutUpdateNotebookMetadataInput,
} from '@faims3/data-model';
import {rootDescriptionForApi} from '@/lib/rootDescriptionField';

export function errorMessageFromNotebookJsonBody(
  json: unknown,
  fallbackStatusText: string
): string {
  if (
    json &&
    typeof json === 'object' &&
    json !== null &&
    'error' in json &&
    typeof (json as {error?: {message?: unknown}}).error?.message === 'string'
  ) {
    return (json as {error: {message: string}}).error.message;
  }
  return fallbackStatusText;
}

/**
 * Creates a new project from a template
 * @param {User} user - The user object
 * @param {string} name - The name of the project
 * @param {string} template - The template ID
 * @returns {Promise<Response>} The response from the API
 */
export const createProjectFromTemplate = async ({
  user,
  name,
  description,
  template,
  teamId,
}: {
  user: User;
  name: string;
  description?: string;
  template: string;
  teamId?: string;
}) =>
  await fetch(`${import.meta.env.VITE_API_URL}/api/notebooks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user.token}`,
    },
    body: JSON.stringify({
      template_id: template,
      name,
      ...rootDescriptionForApi(description),
      teamId,
    }),
  });

/**
 * Creates a new project from a file
 * @param {User} user - The user object
 * @param {string} name - The name of the project
 * @param {File} file - The file to upload
 * @returns {Promise<Response>} The response from the API
 */
export const createProjectFromFile = async ({
  user,
  name,
  description,
  file,
  teamId,
}: {
  user: User;
  name: string;
  description?: string;
  file: File;
  teamId?: string;
}) => {
  const jsonString = await readFileAsText(file);
  if (!jsonString) {
    return new Response(null, {status: 400, statusText: 'Error reading file'});
  }

  let payload: unknown;
  try {
    payload = JSON.parse(jsonString);
  } catch {
    return new Response(null, {status: 400, statusText: 'Invalid JSON file'});
  }

  const prepared = prepareNotebookUiSpecificationInputForApi(payload);
  if (!prepared.ok) {
    return new Response(null, {status: 400, statusText: prepared.message});
  }

  return await fetch(`${import.meta.env.VITE_API_URL}/api/notebooks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user.token}`,
    },
    body: JSON.stringify({
      name,
      ...rootDescriptionForApi(description),
      teamId,
      uiSpecification: prepared.uiSpecification,
    }),
  });
};

/** PUT /api/notebooks/:projectId — merge name and/or description only. */
export const updateNotebookMetadataRequest = async ({
  user,
  projectId,
  name,
  description,
}: {
  user: User;
  projectId: string;
  name?: string;
  description?: string;
}) => {
  const body: PutUpdateNotebookMetadataInput = {};
  if (name !== undefined) body.name = name;
  if (description !== undefined) body.description = description;

  return await fetch(
    `${import.meta.env.VITE_API_URL}/api/notebooks/${encodeURIComponent(projectId)}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.token}`,
      },
      body: JSON.stringify(body),
    }
  );
};

/** PUT /api/notebooks/:projectId/uiSpecification — full design bundle replace. */
export const updateNotebookUiSpecificationRequest = async ({
  user,
  projectId,
  uiSpecification,
}: {
  user: User;
  projectId: string;
  uiSpecification: unknown;
}) =>
  await fetch(
    `${import.meta.env.VITE_API_URL}/api/notebooks/${encodeURIComponent(projectId)}/uiSpecification`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.token}`,
      },
      body: JSON.stringify(uiSpecification),
    }
  );

/** PUT /api/notebooks/:projectId/offlineMapRegion — set or clear recommended region. */
export const updateNotebookOfflineMapRegionRequest = async ({
  user,
  projectId,
  offlineMapRegion,
}: {
  user: User;
  projectId: string;
  offlineMapRegion: OfflineMapRegion | null;
}) =>
  await fetch(
    `${import.meta.env.VITE_API_URL}/api/notebooks/${encodeURIComponent(projectId)}/offlineMapRegion`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.token}`,
      },
      body: JSON.stringify({offlineMapRegion}),
    }
  );

export const modifyTeamForProject = async ({
  projectId,
  teamId,
  user,
}: {
  projectId: string;
  teamId: string;
  user: User;
}) =>
  await fetch(
    `${import.meta.env.VITE_API_URL}/api/notebooks/${projectId}/team`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.token}`,
      },
      body: JSON.stringify({teamId}),
    }
  );

export const removeInviteForProject = async ({
  inviteId,
  projectId,
  user,
}: {
  inviteId: string;
  projectId: string;
  user: User;
}) =>
  await fetch(
    `${import.meta.env.VITE_API_URL}/api/invites/notebook/${projectId}/${inviteId}`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.token}`,
      },
    }
  );

/**
 * Developer-mode API: bulk-create random test records for a notebook.
 * Requires server `DEVELOPER_MODE` and appropriate notebook permission.
 */
export const generateTestRecordsForProject = async ({
  projectId,
  count,
  includeAttachments,
  parallelism,
  user,
}: {
  projectId: string;
  count: number;
  includeAttachments: boolean;
  parallelism: number;
  user: User;
}): Promise<{record_ids: string[]}> => {
  const res = await fetch(
    `${import.meta.env.VITE_API_URL}/api/notebooks/${projectId}/generate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user?.token}`,
      },
      body: JSON.stringify({count, includeAttachments, parallelism}),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(
      `Failed to generate test records (${res.status}): ${err || res.statusText}`
    );
  }
  return res.json();
};

async function messageFromFailedNotebookResponse(
  response: Response
): Promise<string> {
  let message = response.statusText;
  try {
    const body = (await response.json()) as {error?: {message?: string}};
    if (body?.error?.message) message = body.error.message;
  } catch {
    /* ignore */
  }
  return message;
}

/**
 * PUT /api/notebooks/:projectId/status — set notebook lifecycle (OPEN, CLOSED, ARCHIVED).
 */
export const putNotebookStatus = async ({
  user,
  projectId,
  status,
}: {
  user: User;
  projectId: string;
  status: ProjectStatus;
}) => {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/notebooks/${encodeURIComponent(projectId)}/status`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.token}`,
      },
      body: JSON.stringify({status}),
    }
  );
  if (!response.ok) {
    throw new Error(await messageFromFailedNotebookResponse(response));
  }
};

/**
 * POST /api/notebooks/:projectId/delete — permanently delete an archived notebook.
 */
export const postDeleteArchivedNotebook = async ({
  user,
  projectId,
  confirmName,
}: {
  user: User;
  projectId: string;
  confirmName: string;
}) => {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/notebooks/${encodeURIComponent(projectId)}/delete`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.token}`,
      },
      body: JSON.stringify({confirmName}),
    }
  );
  if (!response.ok) {
    throw new Error(await messageFromFailedNotebookResponse(response));
  }
};
