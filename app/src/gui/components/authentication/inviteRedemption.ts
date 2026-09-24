/**
 * Decide how an invite QR or typed code is redeemed.
 *
 * A signed-in app session is a local JWT. Conductor's register page cannot see
 * it, so when a token exists for the invite's server the app redeems in place.
 * Signed-out users still open /register. A signed-in user with no token for
 * that server opens /login.
 */

export type InviteHandoff =
  | 'redeem'
  | 'refresh-then-redeem'
  | 'login'
  | 'register';

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

export function inviteIdFromScannedUrl(url: string): string | null {
  try {
    const inviteId = new URL(url).searchParams.get('inviteId');
    return inviteId && inviteId.length > 0 ? inviteId : null;
  } catch {
    return null;
  }
}

export async function postUseInvite({
  serverUrl,
  inviteId,
  token,
}: {
  serverUrl: string;
  inviteId: string;
  token: string;
}): Promise<{accessToken: string}> {
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
  return (await response.json()) as {accessToken: string};
}
