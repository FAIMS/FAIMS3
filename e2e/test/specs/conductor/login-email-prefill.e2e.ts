/**
 * Conductor /login prefills the identifier from ?email= (including usernames
 * that are not email addresses) and puts it back on the form after a failed
 * local login.
 */
import API_Login from '../../pageobjects/api-login.ts';
import {persona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {getConductorUrl} from '../../helpers/env.ts';

describe('Conductor — Login email prefill', () => {
  const user = persona('projectContributor');

  beforeEach(async () => {
    await browser.reloadSession();
  });

  it('should prefill a local-login email from the query string', async () => {
    await browser.url(
      `${getConductorUrl()}/login?email=${encodeURIComponent(user.email)}`
    );
    await API_Login.waitForPageLoad();
    expect(await API_Login.getEmailValue()).toBe(user.email);
    await captureStep({
      surface: 'conductor',
      label: 'login-email-prefill',
    });
  });

  it('should prefill a local username that is not an email address', async () => {
    await browser.url(`${getConductorUrl()}/login?email=admin`);
    await API_Login.waitForPageLoad();
    expect(await API_Login.getEmailValue()).toBe('admin');
    await captureStep({
      surface: 'conductor',
      label: 'login-username-prefill',
    });
  });

  it('should leave the identifier blank when no email query is present', async () => {
    await browser.url(`${getConductorUrl()}/login`);
    await API_Login.waitForPageLoad();
    expect(await API_Login.getEmailValue()).toBe('');
  });

  it('should keep the identifier on the form after a failed local login', async () => {
    await browser.url(
      `${getConductorUrl()}/login?email=${encodeURIComponent(user.email)}`
    );
    await API_Login.waitForPageLoad();
    await API_Login.enterPassword('not-the-password');
    await API_Login.clickLogin();
    await API_Login.waitForPageLoad();
    expect(await API_Login.hasLoginError()).toBe(true);
    expect(await API_Login.getEmailValue()).toBe(user.email);
    await captureStep({
      surface: 'conductor',
      label: 'login-failed-keeps-email',
    });
  });
});
