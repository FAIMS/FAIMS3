/**
 * Export tab opens Data Export dialog (download prefs / file assert deferred).
 */
import {loginWebPersona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';
import {getWebUrl} from '../../helpers/env.ts';

async function openBlueProject() {
  await browser.url(`${getWebUrl()}/projects`);
  await waitForTestId('web-main', {timeout: 15000});
  const search = byTestId('web-data-table-search');
  if (await search.isExisting()) {
    await search.setValue('Blue');
  }
  const row = await $('tbody tr');
  await row.waitForClickable({timeout: 10000});
  await row.click();
  await browser.waitUntil(
    async () => (await browser.getUrl()).includes('/projects/'),
    {timeout: 10000}
  );
}

describe('Web — Project exports', () => {
  before(async () => {
    await browser.reloadSession();
    await loginWebPersona('managerBlue');
  });

  it('should open Export tab and Data Export dialog', async () => {
    await openBlueProject();
    await waitForTestId('web-project-tab-export');
    await byTestId('web-project-tab-export').click();
    await waitForTestId('web-export-data-button');
    await expect(byTestId('web-export-full-button')).toBeDisplayed();
    await byTestId('web-export-data-button').click();
    await waitForTestId('web-export-data-dialog');
    await captureStep({
      surface: 'web',
      label: 'export-dialog',
    });
  });
});
