/**
 * Fieldmark app login smoke (trimmed from app/login.e2e.ts).
 */
import LoginPage from '../../pageobjects/app-signin.ts';
import {loginAppPersona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';

describe('Smoke — App login', () => {
  beforeEach(async () => {
    await browser.reloadSession();
  });

  it('should display the sign-in page', async () => {
    await LoginPage.open();
    await waitForTestId('onboarding-component');
    await expect(byTestId('app-signin-button')).toBeDisplayed();
    await captureStep({surface: 'app', label: 'signin'});
  });

  it('should login as project contributor', async () => {
    await loginAppPersona('projectContributor');
    const url = await browser.getUrl();
    expect(url.includes('/login')).toBe(false);
    await captureStep({
      surface: 'app',
      label: 'login-success',
    });
  });
});
