import LoginPage from '../../pageobjects/app-signin.js';
import API_Login from '../../pageobjects/api-login.js';

const doLogin = async (username: string, password: string) => {
  // Start from app login page
  await LoginPage.open();
  await LoginPage.clickSignIn();

  // Wait for redirect to API login page
  await API_Login.waitForPageLoad();

  // Perform login if local auth is available
  if (await API_Login.isLocalAuthAvailable()) {
    await API_Login.login(username, password);

    // Wait for redirect or success
    await browser.pause(2000);
  }
};

describe('Login Page', () => {
  const TEST_USERNAME = process.env.TEST_USERNAME || 'test@example.com';
  const TEST_PASSWORD = process.env.TEST_PASSWORD || 'testpassword123';
  const INVALID_EMAIL = 'invalid@example.com';
  const INVALID_PASSWORD = 'wrongpassword';

  beforeEach(async () => {
    // More aggressive cleanup
    await browser.reloadSession();
    await LoginPage.open();
    await browser.pause(1000);
  });

  it('should display login page correctly', async () => {
    await LoginPage.open();
    await LoginPage.verifyPageElements();
    await LoginPage.takeScreenshot('login', 'app-signin-page');
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

    // Wait for redirect to API login page
    await API_Login.waitForPageLoad();
    await API_Login.verifyPageElements();
    await API_Login.takeScreenshot('login', 'api-login-page');
  });

  it('should login successfully with valid credentials', async () => {
    await doLogin(TEST_USERNAME, TEST_PASSWORD);

    // Check if we were redirected away from login page or got success message
    const currentUrl = await browser.getUrl();
    const hasSuccessMessage = await API_Login.hasSuccessMessage();

    // Assert either redirect occurred or success message is shown
    expect(!currentUrl.includes('/login') || hasSuccessMessage).toBe(true);

    await API_Login.takeScreenshot('login', 'successful-login');
  });

  it('should show an error for invalid credentials', async () => {
    // Start from app login page
    await doLogin(INVALID_EMAIL, INVALID_PASSWORD);

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
