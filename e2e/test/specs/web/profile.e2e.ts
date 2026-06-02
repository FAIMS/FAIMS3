import WebAuth from '../../pageobjects/web/web-auth.ts';
import WebProfilePage from '../../pageobjects/web/web-profile.ts';
/**
 * E2E tests for the User Profile page of the web management dashboard.
 *
 * Credentials: TEST_OPERATIONS_ADMIN_USERNAME / TEST_OPERATIONS_ADMIN_PASSWORD env vars.
 */
describe('Web Dashboard - Profile', () => {
  const TEST_USERNAME =
    process.env.TEST_OPERATIONS_ADMIN_USERNAME || 'test@example.com';
  const TEST_PASSWORD =
    process.env.TEST_OPERATIONS_ADMIN_PASSWORD || 'testpassword123';

  before(async () => {
    await browser.reloadSession();
    await WebAuth.login(TEST_USERNAME, TEST_PASSWORD);
  });

  it('should display the user profile page', async () => {
    await WebProfilePage.open();
    expect(await WebProfilePage.isPageDisplayed()).toBe(true);
    await WebProfilePage.takeScreenshot('web-profile', 'profile-page');
  });

  it("should show the logged-in user's email address", async () => {
    await WebProfilePage.open();
    const pageText = await WebProfilePage.getPageText();
    // The profile page renders user.id which is the user's email address.
    expect(pageText).toContain(TEST_USERNAME);
    await WebProfilePage.takeScreenshot('web-profile', 'profile-email');
  });

  it('should show the Change Password button', async () => {
    await WebProfilePage.open();
    await WebProfilePage.waitForChangePasswordButton();
    expect(await WebProfilePage.isChangePasswordButtonDisplayed()).toBe(true);
  });

  it('should show the Manage Long-Lived Tokens button', async () => {
    await WebProfilePage.open();
    await WebProfilePage.waitForManageTokensButton();
    expect(await WebProfilePage.isManageTokensButtonDisplayed()).toBe(true);
    await WebProfilePage.takeScreenshot('web-profile', 'profile-controls');
  });
});
