/**
 * App sign-in UI and Conductor local login (valid / invalid).
 */
import LoginPage from '../../pageobjects/app-signin.ts';
import API_Login from '../../pageobjects/api-login.ts';
import {loginApp, persona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';

describe('Login Page', () => {
  const TEST_USER = persona('projectContributor');
  const INVALID_EMAIL = 'invalid@example.com';
  const INVALID_PASSWORD = 'wrongpassword';

  beforeEach(async () => {
    await browser.reloadSession();
    await LoginPage.open();
  });

  it('should display login page correctly', async () => {
    await LoginPage.open();
    await LoginPage.verifyPageElements();
    await LoginPage.takeScreenshot('login', 'app-signin-page');
    await captureStep({surface: 'app', label: 'signin-page'});
  });

  it('should show short code entry when button clicked', async () => {
    await LoginPage.open();
    await LoginPage.clickEnterCode();
    expect(await LoginPage.shortCodeInput.isDisplayed()).toBe(true);
    await LoginPage.takeScreenshot('login', 'short-code-entry');
  });

  it('should navigate to API login page when Sign In clicked', async () => {
    await LoginPage.open();
    await LoginPage.clickSignIn();

    await API_Login.waitForPageLoad();
    await API_Login.verifyPageElements();
    await API_Login.takeScreenshot('login', 'api-login-page');
  });

  it('should login successfully with valid credentials', async () => {
    // App sign-in → Conductor local auth → redirect back (or success message)
    await loginApp(TEST_USER);

    // Assert either redirect occurred or success message is shown
    const currentUrl = await browser.getUrl();
    const hasSuccessMessage = await API_Login.hasSuccessMessage();
    expect(!currentUrl.includes('/login') || hasSuccessMessage).toBe(true);

    await API_Login.takeScreenshot('login', 'successful-login');
    await captureStep({
      surface: 'app',
      label: 'login-success',
    });
  });

  it('should show an error for invalid credentials', async () => {
    // Start from app login page, then Conductor form with bad credentials
    await LoginPage.open();
    await LoginPage.clickSignIn();
    await API_Login.waitForPageLoad();
    await API_Login.login(INVALID_EMAIL, INVALID_PASSWORD);

    // Wait for error message to appear
    await browser.waitUntil(
      async () =>
        (await API_Login.hasLoginError()) || (await API_Login.hasEmailError()),
      {
        timeout: 5000,
        timeoutMsg: 'Expected login or email error message to appear',
      }
    );

    // Check for error messages (not success)
    const hasError =
      (await API_Login.hasLoginError()) || (await API_Login.hasEmailError());
    expect(hasError).toBe(true);

    await API_Login.takeScreenshot('login', 'invalid-login');
  });
});
