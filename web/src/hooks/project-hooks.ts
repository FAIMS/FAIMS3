import {User} from '@/context/auth-provider';
import {readFileAsText} from '@/lib/utils';

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

  return await fetch(`${import.meta.env.VITE_API_URL}/api/notebooks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user.token}`,
    },
    body: JSON.stringify({name, teamId, ...JSON.parse(jsonString)}),
  });
};

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
 * PUT /api/notebooks/:projectId/archive — set notebook archive status.
 */
export const putNotebookArchive = async ({
  user,
  projectId,
  archive,
}: {
  user: User;
  projectId: string;
  archive: boolean;
}) => {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/notebooks/${encodeURIComponent(projectId)}/archive`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.token}`,
      },
      body: JSON.stringify({archive}),
    }
  );
  if (!response.ok) {
    throw new Error(await messageFromFailedNotebookResponse(response));
  }
};

/**
 * POST /api/notebooks/:projectId/restore — restore an archived notebook (e.g. to closed state).
 */
export const postRestoreArchivedNotebook = async ({
  user,
  projectId,
}: {
  user: User;
  projectId: string;
}) => {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/notebooks/${encodeURIComponent(projectId)}/restore`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${user.token}`,
      },
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
