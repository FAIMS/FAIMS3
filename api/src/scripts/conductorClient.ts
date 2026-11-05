// SPDX-License-Identifier: Apache-2.0
/**
 * Exchange a long-lived FAIMS_API_TOKEN for short-lived access JWTs and
 * retry once on 401.
 */
const TOKEN_REFRESH_SKEW_MS = 60_000;

const jwtExpiryMs = (token: string): number | undefined => {
  const parts = token.split('.');
  if (parts.length < 2 || !parts[1]) {
    return undefined;
  }
  try {
    const json = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8')
    ) as {exp?: unknown};
    return typeof json.exp === 'number' ? json.exp * 1000 : undefined;
  } catch {
    return undefined;
  }
};

export const readResponseBody = async (response: Response): Promise<string> => {
  const text = await response.text();
  try {
    const json = JSON.parse(text) as {message?: string; error?: string};
    return json.message ?? json.error ?? text;
  } catch {
    return text;
  }
};

export class ConductorClient {
  private accessToken: string | undefined;
  private expiresAtMs = 0;

  constructor(
    private readonly baseUrl: string,
    private readonly longLivedToken: string
  ) {}

  async exchange(): Promise<string> {
    const response = await fetch(
      `${this.baseUrl}/api/auth/exchange-long-lived-token`,
      {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({token: this.longLivedToken}),
      }
    );
    if (!response.ok) {
      const detail = await readResponseBody(response);
      throw new Error(
        `Long-lived token exchange failed (${response.status}): ${detail}`
      );
    }
    const body = (await response.json()) as {token?: unknown};
    if (typeof body.token !== 'string' || body.token.length === 0) {
      throw new Error('Token exchange did not return an access token');
    }
    this.accessToken = body.token;
    this.expiresAtMs = jwtExpiryMs(body.token) ?? Date.now() + 4 * 60 * 1000;
    return this.accessToken;
  }

  async accessTokenFresh(): Promise<string> {
    if (
      !this.accessToken ||
      Date.now() >= this.expiresAtMs - TOKEN_REFRESH_SKEW_MS
    ) {
      return this.exchange();
    }
    return this.accessToken;
  }

  async request(
    apiPath: string,
    init: RequestInit,
    retryOnUnauthorized = true
  ): Promise<Response> {
    const token = await this.accessTokenFresh();
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(`${this.baseUrl}${apiPath}`, {
      ...init,
      headers,
    });
    if (response.status === 401 && retryOnUnauthorized) {
      await this.exchange();
      return this.request(apiPath, init, false);
    }
    return response;
  }
}
