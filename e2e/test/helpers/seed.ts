/**
 * Lightweight authenticated API helpers for e2e setup/teardown.
 * Prefer UI flows when they are the workflow under test; use these to obtain
 * invite codes / reset URLs without relying on email delivery.
 */
import {browser} from '@wdio/globals';
import {getConductorUrl} from './env.ts';

export type WebAuthSession = {
  token: string;
  refreshToken?: string;
};

/**
 * Read Control Centre auth session from localStorage (`user` key).
 * Call after a successful `loginWeb` / `loginWebPersona`.
 */
export async function getWebAuthSession(): Promise<WebAuthSession> {
  const session = await browser.execute(() => {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as {token?: string; refreshToken?: string};
      if (!parsed.token) return null;
      return {token: parsed.token, refreshToken: parsed.refreshToken};
    } catch {
      return null;
    }
  });
  if (!session?.token) {
    throw new Error(
      'No Control Centre auth token in localStorage — loginWeb first'
    );
  }
  return session;
}

/**
 * Admin: POST /api/reset → {code, url}. Does not send email to the test runner.
 */
export async function requestPasswordResetLink(
  email: string,
  token?: string
): Promise<{code: string; url: string}> {
  const authToken = token ?? (await getWebAuthSession()).token;
  const api = getConductorUrl().replace(/\/$/, '');
  const result = await browser.execute(
    async (apiBase: string, bearer: string, targetEmail: string) => {
      const res = await fetch(`${apiBase}/api/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bearer}`,
        },
        body: JSON.stringify({email: targetEmail}),
      });
      const body = await res.json().catch(() => ({}));
      return {ok: res.ok, status: res.status, body};
    },
    api,
    authToken,
    email
  );
  if (!result.ok) {
    throw new Error(
      `POST /api/reset failed (${result.status}): ${JSON.stringify(result.body)}`
    );
  }
  const body = result.body as {code?: string; url?: string};
  if (!body.code || !body.url) {
    throw new Error(`Unexpected /api/reset response: ${JSON.stringify(body)}`);
  }
  return {code: body.code, url: body.url};
}

/**
 * Public: PUT /api/reset with code + newPassword (no auth).
 */
export async function completePasswordReset(
  code: string,
  newPassword: string
): Promise<void> {
  const api = getConductorUrl().replace(/\/$/, '');
  const result = await browser.execute(
    async (apiBase: string, resetCode: string, password: string) => {
      const res = await fetch(`${apiBase}/api/reset`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({code: resetCode, newPassword: password}),
      });
      const body = await res.json().catch(() => ({}));
      return {ok: res.ok, status: res.status, body};
    },
    api,
    code,
    newPassword
  );
  if (!result.ok) {
    throw new Error(
      `PUT /api/reset failed (${result.status}): ${JSON.stringify(result.body)}`
    );
  }
}
