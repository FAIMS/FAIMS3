import {User} from '@/context/auth-provider';
import {Role, TeamMembershipInput} from '@faims3/data-model';

/**
 * Creates a new team
 * @param {User} user - The user object
 * @param name - the team name
 * @param description - the team description
 * @returns {Promise<Response>} The response from the API
 */
export const createTeam = async ({
  user,
  name,
  description,
}: {
  user: User;
  name: string;
  description: string;
}) =>
  await fetch(`${import.meta.env.VITE_API_URL}/api/teams`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user.token}`,
    },
    body: JSON.stringify({
      name,
      description,
    }),
  });

/**
 * Updates an existing team
 * @param {User} user - The user object
 * @param name - the team name
 * @param description - the team description
 * @returns {Promise<Response>} The response from the API
 */
export const updateTeam = async ({
  user,
  name,
  teamId,
  description,
}: {
  user: User;
  teamId: string;
  name: string;
  description: string;
}) =>
  await fetch(`${import.meta.env.VITE_API_URL}/api/teams/${teamId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user.token}`,
    },
    body: JSON.stringify({
      name,
      description,
    }),
  });

/**
 * Modifies team membership
 */
export const modifyMemberForTeam = async ({
  user,
  email,
  role,
  teamId,
  action,
}: {
  user: User;
  email: string;
  // use Role once import works
  role?: string;
  teamId: string;
  action: TeamMembershipInput['action'];
}) =>
  await fetch(`${import.meta.env.VITE_API_URL}/api/teams/${teamId}/members`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user.token}`,
    },
    body: JSON.stringify({
      action,
      // TODO remove cast
      role: role as Role,
      username: email,
    } satisfies TeamMembershipInput),
  });

export const removeInviteForTeam = async ({
  inviteId,
  teamId,
  user,
}: {
  inviteId: string;
  teamId: string;
  user: User;
}) =>
  await fetch(
    `${import.meta.env.VITE_API_URL}/api/invites/team/${teamId}/${inviteId}`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.token}`,
      },
    }
  );
