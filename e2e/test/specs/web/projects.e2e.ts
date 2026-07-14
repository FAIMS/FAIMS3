import WebAuth from '../../pageobjects/web/web-auth.ts';
import WebProjectsPage from '../../pageobjects/web/web-projects.ts';

/**
 * E2E tests for the Projects list page of the web management dashboard.
 *
 * Team member suite: TEST_USER_USERNAME / TEST_USER_PASSWORD (seed-member-both).
 * Operations admin suite: TEST_OPERATIONS_ADMIN_USERNAME / TEST_OPERATIONS_ADMIN_PASSWORD.
 *
 * The tests do not assert on row count because no test-data pre-seeding is
 * performed at this stage — an empty list is a valid state.
 */
describe('Web Dashboard - Projects Team Member', () => {
  const TEST_USERNAME =
    process.env.TEST_MEMBER_BOTH_USERNAME || 'test@example.com';
  const TEST_PASSWORD =
    process.env.TEST_MEMBER_BOTH_PASSWORD || 'testpassword123';

  before(async () => {
    // Start each suite with a clean session to avoid state leaking from other
    // test files.
    await browser.reloadSession();
    await WebAuth.login(TEST_USERNAME, TEST_PASSWORD);
  });

  it('should display the projects page after login', async () => {
    await WebProjectsPage.open();
    expect(await WebProjectsPage.isPageDisplayed()).toBe(true);
    await WebProjectsPage.takeScreenshot(
      'web-projects',
      'projects-list-team-member'
    );
  });
});

describe('Web Dashboard - Projects - Member Creator', () => {
  const TEST_USERNAME =
    process.env.TEST_RED_MEMBER_CREATOR_USERNAME || 'test@example.com';
  const TEST_PASSWORD =
    process.env.TEST_RED_MEMBER_CREATOR_PASSWORD || 'testpassword123';

  before(async () => {
    await browser.reloadSession();
    await WebAuth.login(TEST_USERNAME, TEST_PASSWORD);
  });

  it('should show a create project button', async () => {
    await WebProjectsPage.open();
    // Wait for the button to become visible (it is rendered after the data
    // fetch resolves, even when the list is empty).
    await WebProjectsPage.waitForCreateButton();
    expect(await WebProjectsPage.isCreateButtonDisplayed()).toBe(true);
  });
});

describe('Web Dashboard - Projects - Operations Admin', () => {
  const TEST_USERNAME =
    process.env.TEST_OPERATIONS_ADMIN_USERNAME || 'test@example.com';
  const TEST_PASSWORD =
    process.env.TEST_OPERATIONS_ADMIN_PASSWORD || 'testpassword123';

  before(async () => {
    // Start each suite with a clean session to avoid state leaking from other
    // test files.
    await browser.reloadSession();
    await WebAuth.login(TEST_USERNAME, TEST_PASSWORD);
  });

  it('should display the projects page after login', async () => {
    await WebProjectsPage.open();
    expect(await WebProjectsPage.isPageDisplayed()).toBe(true);
    await WebProjectsPage.takeScreenshot(
      'web-projects',
      'projects-list-operations-admin'
    );
  });

  // check that the Users menu is visible for operations admin
});
