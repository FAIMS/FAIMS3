/**
 * Templates list and create from team Templates tab (team manager).
 */
import {loginWebPersona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';
import WebTemplatesPage from '../../pageobjects/web/web-templates.ts';
import {getWebUrl} from '../../helpers/env.ts';

async function openBlueTeamTemplatesTab() {
  await browser.url(`${getWebUrl()}/teams`);
  await waitForTestId('web-teams-heading');
  const search = byTestId('web-data-table-search');
  if (await search.isExisting()) {
    await search.setValue('Blue');
  }
  const row = await $('tbody tr');
  await row.waitForClickable({timeout: 10000});
  await row.click();
  await browser.waitUntil(
    async () => (await browser.getUrl()).includes('/teams/'),
    {timeout: 10000}
  );
  const templatesTab = await $('button*=Templates');
  await templatesTab.waitForClickable({timeout: 10000});
  await templatesTab.click();
}

describe('Web Dashboard — Templates create', () => {
  const templateName = `E2E Template ${Date.now()}`;

  before(async () => {
    await browser.reloadSession();
    // CREATE_TEMPLATE_IN_TEAM is a TEAM_MANAGER action (not TEAM_MEMBER_CREATOR)
    await loginWebPersona('managerBlue');
  });

  it('should display the templates list', async () => {
    await WebTemplatesPage.open();
    expect(await WebTemplatesPage.isPageDisplayed()).toBe(true);
    await captureStep({
      surface: 'web',
      label: 'templates-list',
    });
  });

  it('should open create template dialog from team Templates tab', async () => {
    await openBlueTeamTemplatesTab();
    await waitForTestId('web-templates-create-button', {timeout: 15000});
    await byTestId('web-templates-create-button').click();
    await waitForTestId('web-templates-create-dialog');
    await expect(byTestId('web-templates-create-dialog')).toBeDisplayed();
    await captureStep({
      surface: 'web',
      label: 'create-template-dialog',
    });
  });

  it('should create a template in the team', async () => {
    await openBlueTeamTemplatesTab();
    await waitForTestId('web-templates-create-button');
    await byTestId('web-templates-create-button').click();
    await waitForTestId('web-templates-create-name');
    await byTestId('web-templates-create-name').setValue(templateName);
    await byTestId('web-templates-create-submit').click();
    await browser.waitUntil(
      async () => {
        const text = await $('main').getText();
        return text.includes(templateName);
      },
      {
        timeout: 20000,
        timeoutMsg: `Expected template "${templateName}" after create`,
      }
    );
    await captureStep({
      surface: 'web',
      label: 'template-created',
    });
  });
});
