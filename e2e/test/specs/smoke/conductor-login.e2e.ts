/**
 * Conductor local login smoke.
 */
import API_Login from '../../pageobjects/api-login.ts';
import {loginConductor, persona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {getConductorUrl} from '../../helpers/env.ts';
import {byTestId} from '../../helpers/selectors.ts';

describe('Smoke — Conductor login', () => {
  const user = persona('operationsAdmin');

  before(async () => {
    await browser.reloadSession();
  });

  it('should show the Conductor login form', async () => {
    await browser.url(`${getConductorUrl()}/login`);
    await API_Login.waitForPageLoad();
    await expect(byTestId('login-form')).toBeDisplayed();
    await expect(byTestId('login-submit-button')).toBeDisplayed();
    await captureStep({
      surface: 'conductor',
      label: 'login-form',
    });
  });

  it('should login with operations admin credentials', async () => {
    await loginConductor(user, {redirect: 'http://localhost:3001/'});
    await browser.waitUntil(
      async () => !(await browser.getUrl()).includes('/login'),
      {
        timeout: 15000,
        timeoutMsg: 'Expected redirect away from /login after Conductor login',
      }
    );
    await captureStep({
      surface: 'conductor',
      label: 'login-success',
    });
  });
});
