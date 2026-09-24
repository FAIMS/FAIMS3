import {describe, expect, it} from 'vitest';
import {
  chooseInviteHandoff,
  conductorInviteUrl,
  inviteIdFromScannedUrl,
} from './inviteRedemption';

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
