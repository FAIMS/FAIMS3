/**
 * Control Centre expired-session redirect prefills Conductor login for a
 * local-password user and omits ?email= for an SSO-only payload.
 */
import API_Login from '../../pageobjects/api-login.ts';
import {persona, seedExpiredWebSession} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {getWebUrl} from '../../helpers/env.ts';
import {waitForUrl} from '../../helpers/wait.ts';

describe('Web — Expired session email prefill', () => {
  const user = persona('memberBoth');

  beforeEach(async () => {
    await browser.reloadSession();
  });

  it('should prefill Conductor login after a local session expires', async () => {
    await seedExpiredWebSession({
      email: user.email,
      hasLocalProfile: true,
    });
    await browser.url(getWebUrl());
    await waitForUrl('/login', {
      timeout: 20000,
      timeoutMsg:
        'Expected redirect to Conductor login after the session was invalidated',
    });
    await API_Login.waitForPageLoad();
    expect(await API_Login.getEmailValue()).toBe(user.email);
    await captureStep({
      surface: 'web',
      label: 'expired-session-email-prefill',
    });
  });

  it('should omit the identifier when the expired user has no local profile', async () => {
    await seedExpiredWebSession({
      email: user.email,
      hasLocalProfile: false,
    });
    await browser.url(getWebUrl());
    await waitForUrl('/login', {
      timeout: 20000,
      timeoutMsg:
        'Expected redirect to Conductor login after the session was invalidated',
    });
    await API_Login.waitForPageLoad();
    expect(await API_Login.getEmailValue()).toBe('');
    await captureStep({
      surface: 'web',
      label: 'expired-session-sso-no-email',
    });
  });
});
