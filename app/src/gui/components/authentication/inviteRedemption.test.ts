import {Resource, Role, RoleScope} from '@faims3/data-model';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  activeInviteUsername,
  chooseInviteHandoff,
  conductorInviteUrl,
  inviteIdFromScannedUrl,
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

describe('invite URLs', () => {
  it('reads inviteId from a register QR payload', () => {
    expect(
      inviteIdFromScannedUrl(
        'https://conductor.example/register?inviteId=FAIMS-abc&redirect=https://app/auth-return'
      )
    ).toBe('FAIMS-abc');
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
