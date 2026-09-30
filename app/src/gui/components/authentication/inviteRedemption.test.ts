// SPDX-License-Identifier: Apache-2.0
import {Resource, Role, RoleScope} from '@faims3/data-model';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  activeInviteUsername,
  chooseInviteHandoff,
  conductorInviteUrl,
  inviteIdFromScannedUrl,
  inviteRegisterUrl,
  postUseInvite,
} from './inviteRedemption';

describe('activeInviteUsername', () => {
  it('uses the switched active user when they are on the invite server', () => {
    expect(
      activeInviteUsername({
        activeServerId: 'server-x',
        activeUsername: 'alice',
        inviteServerId: 'server-x',
      })
    ).toBe('alice');
  });

  it('ignores a session that is active on a different server', () => {
    expect(
      activeInviteUsername({
        activeServerId: 'server-y',
        activeUsername: 'alice',
        inviteServerId: 'server-x',
      })
    ).toBeUndefined();
  });

  it('ignores a signed-out app', () => {
    expect(
      activeInviteUsername({
        activeServerId: undefined,
        activeUsername: undefined,
        inviteServerId: 'server-x',
      })
    ).toBeUndefined();
  });
});

describe('chooseInviteHandoff', () => {
  it('redeems in the app when a token for that server is still valid', () => {
    expect(
      chooseInviteHandoff({
        tokenValid: true,
        tokenRefreshable: true,
        signedIn: true,
      })
    ).toBe('redeem');
  });

  it('refreshes an expired access token before redeeming', () => {
    expect(
      chooseInviteHandoff({
        tokenValid: false,
        tokenRefreshable: true,
        signedIn: true,
      })
    ).toBe('refresh-then-redeem');
  });

  it('opens sign-in when the user is signed in but has no token for that server', () => {
    expect(
      chooseInviteHandoff({
        tokenValid: false,
        tokenRefreshable: false,
        signedIn: true,
      })
    ).toBe('login');
  });

  it('opens register when nobody is signed in', () => {
    expect(
      chooseInviteHandoff({
        tokenValid: false,
        tokenRefreshable: false,
        signedIn: false,
      })
    ).toBe('register');
  });
});

/** Same host checks as InviteQRScanner / InviteQRRegistration. */
function scannerAccepts(url: string, serverUrl: string): boolean {
  return url.startsWith(serverUrl) && !!url.match(`${serverUrl}/register.*`);
}

/** What the Share dialog used to encode: URL() drops :443 / :80. */
function urlConstructorPayload(serverUrl: string, inviteId: string): string {
  const url = new URL(`${serverUrl}/register`);
  url.searchParams.set('inviteId', inviteId);
  return url.toString();
}

describe('invite URLs', () => {
  it('reads inviteId from a register QR payload', () => {
    expect(
      inviteIdFromScannedUrl(
        'https://conductor.example/register?inviteId=FAIMS-abc&redirect=https://app/auth-return'
      )
    ).toBe('FAIMS-abc');
  });

  it('builds a register QR payload the scanner can redeem', () => {
    const cases = [
      {
        serverUrl: 'https://conductor.example/',
        qr: 'https://conductor.example//register?inviteId=FAIMS-abc',
      },
      {
        serverUrl: 'https://conductor.example',
        qr: 'https://conductor.example/register?inviteId=FAIMS-abc',
      },
      {
        serverUrl: 'https://conductor.example:443',
        qr: 'https://conductor.example:443/register?inviteId=FAIMS-abc',
      },
      {
        serverUrl: 'https://conductor.example:443/',
        qr: 'https://conductor.example:443//register?inviteId=FAIMS-abc',
      },
      {
        serverUrl: 'http://conductor.example:80',
        qr: 'http://conductor.example:80/register?inviteId=FAIMS-abc',
      },
    ];
    for (const {serverUrl, qr} of cases) {
      const url = inviteRegisterUrl({
        serverUrl,
        inviteId: 'FAIMS-abc',
      });
      expect(url).toBe(qr);
      expect(inviteIdFromScannedUrl(url)).toBe('FAIMS-abc');
      expect(scannerAccepts(url, serverUrl)).toBe(true);
    }
  });

  it('keeps a default HTTPS port so a CDK conductor_url still scans', () => {
    const serverUrl = 'https://conductor.bss.nbic.cloud:443';
    const inviteId = 'FAIMS-abc';
    const encoded = inviteRegisterUrl({serverUrl, inviteId});
    const stripped = urlConstructorPayload(serverUrl, inviteId);

    expect(encoded).toBe(
      'https://conductor.bss.nbic.cloud:443/register?inviteId=FAIMS-abc'
    );
    expect(stripped).toBe(
      'https://conductor.bss.nbic.cloud/register?inviteId=FAIMS-abc'
    );
    expect(scannerAccepts(encoded, serverUrl)).toBe(true);
    expect(scannerAccepts(stripped, serverUrl)).toBe(false);
  });

  it('still accepts a Conductor invite QR that includes a redirect param', () => {
    const serverUrl = 'https://conductor.example:443';
    const conductorQr = `${serverUrl}/register?redirect=https://web.example&inviteId=FAIMS-abc`;
    expect(scannerAccepts(conductorQr, serverUrl)).toBe(true);
    expect(inviteIdFromScannedUrl(conductorQr)).toBe('FAIMS-abc');
  });

  it('builds a login URL that keeps the invite and the app redirect', () => {
    expect(
      conductorInviteUrl({
        serverUrl: 'https://conductor.example/',
        inviteId: 'FAIMS-abc',
        page: 'login',
        redirectTo: 'org.example://auth-return',
      })
    ).toBe(
      'https://conductor.example/login?inviteId=FAIMS-abc&redirect=org.example%3A%2F%2Fauth-return'
    );
  });
});

describe('postUseInvite', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the invite and returns the parsed response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        inviteType: RoleScope.RESOURCE_SPECIFIC,
        resourceType: Resource.PROJECT,
        resourceId: 'notebook-1',
        role: Role.PROJECT_CONTRIBUTOR,
        accessToken: 'fresh-token',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      postUseInvite({
        serverUrl: 'https://conductor.example/',
        inviteId: 'FAIMS-abc',
        token: 'session-token',
      })
    ).resolves.toEqual({
      success: true,
      inviteType: RoleScope.RESOURCE_SPECIFIC,
      resourceType: Resource.PROJECT,
      resourceId: 'notebook-1',
      role: Role.PROJECT_CONTRIBUTOR,
      accessToken: 'fresh-token',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://conductor.example/api/invites/FAIMS-abc/use',
      {
        method: 'POST',
        headers: {Authorization: 'Bearer session-token'},
      }
    );
  });

  it('uses the error message from a non-OK JSON body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({error: {message: 'Invite already used.'}}),
      })
    );

    await expect(
      postUseInvite({
        serverUrl: 'https://conductor.example',
        inviteId: 'FAIMS-abc',
        token: 'session-token',
      })
    ).rejects.toThrow('Invite already used.');
  });

  it('falls back when a non-OK body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => {
          throw new SyntaxError('Unexpected token');
        },
      })
    );

    await expect(
      postUseInvite({
        serverUrl: 'https://conductor.example',
        inviteId: 'FAIMS-abc',
        token: 'session-token',
      })
    ).rejects.toThrow('Could not use this invite.');
  });
});
