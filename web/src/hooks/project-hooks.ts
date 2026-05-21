import {User} from '@/context/auth-provider';
import {readFileAsText} from '@/lib/utils';
import type {ProjectStatus, PutUpdateNotebookMetadataInput} from '@faims3/data-model';

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
  template,
  teamId,
}: {
  user: User;
  name: string;
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
/** Extract design bundle from a notebook JSON file (current or legacy wire keys). */
export function uiSpecificationFromNotebookJsonPayload(
  payload: Record<string, unknown>
): unknown {
  if (payload.uiSpecification !== undefined) {
    return payload.uiSpecification;
  }
  if (
    payload.metadata !== undefined ||
    payload['ui-specification'] !== undefined
  ) {
    return {
      metadata: payload.metadata,
      'ui-specification': payload['ui-specification'],
    };
  }
  return payload;
}

export const createProjectFromFile = async ({
  user,
  name,
  file,
  teamId,
}: {
  user: User;
  name: string;
  file: File;
  teamId?: string;
}) => {
  const jsonString = await readFileAsText(file);
  const payload = JSON.parse(jsonString) as Record<string, unknown>;

  return await fetch(`${import.meta.env.VITE_API_URL}/api/notebooks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user.token}`,
    },
    body: JSON.stringify({
      name,
      teamId,
      ...(typeof payload.description === 'string'
        ? {description: payload.description}
        : {}),
      uiSpecification: uiSpecificationFromNotebookJsonPayload(payload),
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

export const generateTestRecordsForProject = async ({
  projectId,
  count,
  user,
}: {
  projectId: string;
  count: number;
  user: User;
}) => {
  const res = await fetch(
    `${import.meta.env.VITE_API_URL}/api/notebooks/${projectId}/generate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user?.token}`,
      },
      body: JSON.stringify({count}),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Save failed: ${res.status} ${err}`);
  }
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
