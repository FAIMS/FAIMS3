/**
 * Teams list, create team, open team detail.
 */
import {loginWebPersona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import WebTeamsPage from '../../pageobjects/web/web-teams.ts';
import {getWebUrl} from '../../helpers/env.ts';

describe('Web Dashboard — Teams', () => {
  const teamName = `E2E Team ${Date.now()}`;

  before(async () => {
    await browser.reloadSession();
    await loginWebPersona('operationsAdmin');
  });

  it('should display the teams list', async () => {
    await WebTeamsPage.open();
    expect(await WebTeamsPage.isPageDisplayed()).toBe(true);
    await captureStep({surface: 'web', label: 'teams-list'});
  });

  it('should open the create team dialog', async () => {
    await WebTeamsPage.open();
    await WebTeamsPage.openCreateDialog();
    await expect(byTestId('web-teams-create-dialog')).toBeDisplayed();
    await expect(byTestId('web-teams-create-name')).toBeDisplayed();
    await captureStep({
      surface: 'web',
      label: 'create-team-dialog',
    });
  });

  it('should create a team and show it in the list', async () => {
    await WebTeamsPage.open();
    await WebTeamsPage.createTeam(teamName, 'Created by e2e suite');
    // Create closes the dialog and refreshes the list (no auto-navigate)
    await browser.waitUntil(
      async () => {
        const body = await $('main').getText();
        return body.includes(teamName);
      },
      {
        timeout: 20000,
        timeoutMsg: `Expected new team "${teamName}" in teams list`,
      }
    );
    await captureStep({
      surface: 'web',
      label: 'team-created',
    });
  });

  it('should show team detail tabs', async () => {
    await browser.url(`${getWebUrl()}/teams`);
    await WebTeamsPage.waitForPageLoad();
    const link = await $('a[href*="/teams/"]');
    await link.waitForClickable({timeout: 10000});
    await link.click();
    await browser.waitUntil(
      async () => (await browser.getUrl()).match(/\/teams\/[^/]+/) !== null,
      {timeout: 10000}
    );
    // Radix TabsTrigger
    const details = await $('button*=Details');
    // Prefer a simple text match if compound selector is invalid
    const tab = details;
    await tab.waitForDisplayed({timeout: 10000});
    expect(await tab.isDisplayed()).toBe(true);
    await captureStep({
      surface: 'web',
      label: 'team-detail-tabs',
    });
  });
});
