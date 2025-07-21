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
