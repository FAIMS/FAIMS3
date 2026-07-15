import {User} from '@/context/auth-provider';
import {config} from '@/constants';

export const removeGlobalInvite = async ({
  inviteId,
  user,
}: {
  inviteId: string;
  user: User;
}) =>
  await fetch(`${config.apiUrl}/api/invites/global/${inviteId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user.token}`,
    },
  });
