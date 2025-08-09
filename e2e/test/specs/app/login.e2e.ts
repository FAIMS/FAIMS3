import LoginPage from '../../pageobjects/app-signin.js';

describe('Login Page', () => {
  it('should display login page correctly', async () => {
    await LoginPage.open();
    await LoginPage.verifyPageElements();
    await LoginPage.takeScreenshot('login', 'login-page');
  });

  it('should show short code entry when button clicked', async () => {
    await LoginPage.clickEnterCode();
    expect(await LoginPage.shortCodeInput.isDisplayed()).toBe(true);
    await LoginPage.takeScreenshot('login', 'short-code-entry');
  });
});
