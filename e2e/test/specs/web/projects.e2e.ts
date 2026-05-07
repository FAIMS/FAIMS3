import WebAuth from '../../pageobjects/web/web-auth.ts';
import WebProjectsPage from '../../pageobjects/web/web-projects.ts';

/**
 * E2E tests for the Projects list page of the web management dashboard.
 *
 * Credentials: TEST_ADMIN_USERNAME / TEST_ADMIN_PASSWORD env vars.
 * Falls back to TEST_USERNAME / TEST_PASSWORD for backwards compatibility.
 *
 * The tests do not assert on row count because no test-data pre-seeding is
 * performed at this stage — an empty list is a valid state.
 */
describe('Web Dashboard - Projects', () => {
  const TEST_USERNAME =
    process.env.TEST_ADMIN_USERNAME ||
    process.env.TEST_USERNAME ||
    'test@example.com';
  const TEST_PASSWORD =
    process.env.TEST_ADMIN_PASSWORD ||
    process.env.TEST_PASSWORD ||
    'testpassword123';

  before(async () => {
    // Start each suite with a clean session to avoid state leaking from other
    // test files.
    await browser.reloadSession();
    await WebAuth.login(TEST_USERNAME, TEST_PASSWORD);
  });

  it('should display the projects page after login', async () => {
    await WebProjectsPage.open();
    expect(await WebProjectsPage.isPageDisplayed()).toBe(true);
    await WebProjectsPage.takeScreenshot('web-projects', 'projects-list');
  });

  it('should show a create project button', async () => {
    await WebProjectsPage.open();
    // Wait for the button to become visible (it is rendered after the data
    // fetch resolves, even when the list is empty).
    await WebProjectsPage.createButton.waitForDisplayed({timeout: 10000});
    expect(await WebProjectsPage.isCreateButtonDisplayed()).toBe(true);
    await WebProjectsPage.takeScreenshot(
      'web-projects',
      'projects-create-button'
    );
  });
});
