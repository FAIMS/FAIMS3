/**
 * Lightweight authenticated API helpers for e2e setup/teardown.
 * Prefer UI flows when they are the workflow under test; use these to obtain
 * invite codes / reset URLs without relying on email delivery.
 */
import {browser} from '@wdio/globals';
import {getConductorUrl, getWebUrl} from './env.ts';

export type WebAuthSession = {
  token: string;
  refreshToken?: string;
};

export type InviteSummary = {
  inviteId: string;
  registerUrl: string;
};

type TeamSummary = {_id: string; name: string};

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

async function apiFetchJson(
  path: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
    token?: string;
  } = {}
): Promise<{ok: boolean; status: number; body: unknown}> {
  const authToken = options.token ?? (await getWebAuthSession()).token;
  const api = getConductorUrl().replace(/\/$/, '');
  return browser.execute(
    async (
      apiBase: string,
      bearer: string,
      apiPath: string,
      method: string,
      bodyJson: string | null
    ) => {
      const res = await fetch(`${apiBase}${apiPath}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bearer}`,
        },
        body: bodyJson,
      });
      const body = await res.json().catch(() => ({}));
      return {ok: res.ok, status: res.status, body};
    },
    api,
    authToken,
    path,
    options.method ?? 'GET',
    options.body ? JSON.stringify(options.body) : null
  );
}

/** GET /api/teams — teams visible to the current session. */
export async function listTeams(token?: string): Promise<TeamSummary[]> {
  const result = await apiFetchJson('/api/teams', {token});
  if (!result.ok) {
    throw new Error(
      `GET /api/teams failed (${result.status}): ${JSON.stringify(result.body)}`
    );
  }
  const body = result.body as {teams?: TeamSummary[]};
  return body.teams ?? [];
}

export async function findTeamIdByName(
  nameSubstring: string,
  token?: string
): Promise<string> {
  const teams = await listTeams(token);
  const match = teams.find(t =>
    t.name.toLowerCase().includes(nameSubstring.toLowerCase())
  );
  if (!match) {
    throw new Error(
      `No team matching "${nameSubstring}" (have: ${teams.map(t => t.name).join(', ')})`
    );
  }
  return match._id;
}

function buildRegisterUrl(inviteId: string, redirect?: string): string {
  const api = getConductorUrl().replace(/\/$/, '');
  const target = redirect ?? `${getWebUrl().replace(/\/$/, '')}/auth-return`;
  return `${api}/register?inviteId=${encodeURIComponent(inviteId)}&redirect=${encodeURIComponent(target)}`;
}

/**
 * POST /api/invites/team/:teamId → invite `_id` + Conductor register URL.
 */
export async function createTeamInvite(options: {
  teamId: string;
  name: string;
  role?: string;
  uses?: number;
  expiry?: number;
  token?: string;
  redirect?: string;
}): Promise<InviteSummary> {
  const result = await apiFetchJson(`/api/invites/team/${options.teamId}`, {
    method: 'POST',
    token: options.token,
    body: {
      name: options.name,
      role: options.role ?? 'TEAM_MEMBER',
      uses: options.uses ?? 1,
      expiry: options.expiry ?? Date.now() + 24 * 60 * 60 * 1000,
    },
  });
  if (!result.ok) {
    throw new Error(
      `POST /api/invites/team failed (${result.status}): ${JSON.stringify(result.body)}`
    );
  }
  const body = result.body as {_id?: string};
  if (!body._id) {
    throw new Error(
      `Unexpected team invite response: ${JSON.stringify(result.body)}`
    );
  }
  return {
    inviteId: body._id,
    registerUrl: buildRegisterUrl(body._id, options.redirect),
  };
}

/**
 * POST /api/invites/global → invite `_id` + Conductor register URL.
 */
export async function createGlobalInvite(options: {
  name: string;
  role?: string;
  uses?: number;
  expiry?: number;
  token?: string;
  redirect?: string;
}): Promise<InviteSummary> {
  const result = await apiFetchJson('/api/invites/global', {
    method: 'POST',
    token: options.token,
    body: {
      name: options.name,
      role: options.role ?? 'GENERAL_CREATOR',
      uses: options.uses ?? 1,
      expiry: options.expiry ?? Date.now() + 24 * 60 * 60 * 1000,
    },
  });
  if (!result.ok) {
    throw new Error(
      `POST /api/invites/global failed (${result.status}): ${JSON.stringify(result.body)}`
    );
  }
  const body = result.body as {_id?: string};
  if (!body._id) {
    throw new Error(
      `Unexpected global invite response: ${JSON.stringify(result.body)}`
    );
  }
  return {
    inviteId: body._id,
    registerUrl: buildRegisterUrl(body._id, options.redirect),
  };
}
