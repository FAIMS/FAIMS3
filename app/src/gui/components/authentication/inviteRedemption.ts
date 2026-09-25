/**
 * Decide how an invite QR or typed code is redeemed.
 *
 * A signed-in app session is a local JWT. Conductor's register page cannot see
 * it, so when the switched active user is on the invite's server and their
 * token is still usable, the app redeems in place. Cached logins for anyone
 * else are ignored. Signed-out users open /register. Anyone else opens /login.
 */

import {
  PostUseInviteResponse,
  PostUseInviteResponseSchema,
} from '@faims3/data-model';

/** How the app should finish an invite after a QR scan or typed code. */
export type InviteHandoff =
  | 'redeem'
  | 'refresh-then-redeem'
  | 'login'
  | 'register';

/**
 * Username allowed to redeem an invite in the app. Only the switched active
 * user on this Conductor qualifies. A cached login for another account, or for
 * this user on a different server, does not.
 */
export function activeInviteUsername({
  activeServerId,
  activeUsername,
  inviteServerId,
}: {
  activeServerId: string | undefined;
  activeUsername: string | undefined;
  inviteServerId: string;
}): string | undefined {
  if (activeServerId !== inviteServerId || !activeUsername) {
    return undefined;
  }
  return activeUsername;
}

/** Pick redeem, refresh-then-redeem, login, or register from token state. */
export function chooseInviteHandoff({
  tokenValid,
  tokenRefreshable,
  signedIn,
}: {
  tokenValid: boolean;
  tokenRefreshable: boolean;
  signedIn: boolean;
}): InviteHandoff {
  if (tokenValid) {
    return 'redeem';
  }
  if (tokenRefreshable) {
    return 'refresh-then-redeem';
  }
  if (signedIn) {
    return 'login';
  }
  return 'register';
}

/** Build a Conductor login/register URL that carries inviteId and redirect. */
export function conductorInviteUrl({
  serverUrl,
  inviteId,
  page,
  redirectTo,
}: {
  serverUrl: string;
  inviteId: string;
  page: 'login' | 'register';
  redirectTo: string;
}): string {
  const url = new URL(`${serverUrl.replace(/\/$/, '')}/${page}`);
  url.searchParams.set('inviteId', inviteId);
  url.searchParams.set('redirect', redirectTo);
  return url.toString();
}

/** Read `inviteId` from a scanned register URL, or null if absent/invalid. */
export function inviteIdFromScannedUrl(url: string): string | null {
  try {
    const inviteId = new URL(url).searchParams.get('inviteId');
    return inviteId && inviteId.length > 0 ? inviteId : null;
  } catch {
    return null;
  }
}

/** POST /api/invites/:inviteId/use and return the parsed grant + access token. */
export async function postUseInvite({
  serverUrl,
  inviteId,
  token,
}: {
  serverUrl: string;
  inviteId: string;
  token: string;
}): Promise<PostUseInviteResponse> {
  const response = await fetch(
    `${serverUrl.replace(/\/$/, '')}/api/invites/${encodeURIComponent(inviteId)}/use`,
    {
      method: 'POST',
      headers: {Authorization: `Bearer ${token}`},
    }
  );
  if (!response.ok) {
    let message = 'Could not use this invite.';
    try {
      const body = (await response.json()) as {error?: {message?: string}};
      if (body?.error?.message) {
        message = body.error.message;
      }
    } catch {
      // Keep the fallback message when the body is not JSON.
    }
    throw new Error(message);
  }
  return PostUseInviteResponseSchema.parse(await response.json());
}
