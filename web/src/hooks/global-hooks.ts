import {User} from '@/context/auth-provider';

export const removeGlobalInvite = async ({
  inviteId,
  user,
}: {
  inviteId: string;
  user: User;
}) =>
  await fetch(
    `${import.meta.env.VITE_API_URL}/api/invites/global/${inviteId}`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.token}`,
      },
    }
  );
