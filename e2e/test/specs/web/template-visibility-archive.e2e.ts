/**
 * Template Actions: visibility (ops admin only) + archive (ops / template admin).
 */
import {loginWebPersona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';
import {getWebUrl} from '../../helpers/env.ts';

async function openTemplateActions(searchTerm: string) {
  await browser.url(`${getWebUrl()}/templates`);
  await waitForTestId('web-templates-heading', {timeout: 15000});
  const search = byTestId('web-data-table-search');
  if (await search.isExisting()) {
    await search.setValue(searchTerm);
  }
  const row = await $('tbody tr');
  await row.waitForClickable({timeout: 15000});
  await row.click();
  await browser.waitUntil(
    async () => (await browser.getUrl()).match(/\/templates\/[^/]+/) !== null,
    {timeout: 10000}
  );
  const actionsTab = await $('button*=Actions');
  await actionsTab.waitForClickable({timeout: 10000});
  await actionsTab.click();
}

describe('Web — Template visibility / archive', () => {
  before(async () => {
    await browser.reloadSession();
    await loginWebPersona('operationsAdmin');
  });

  it('should open visibility dialog and cancel', async () => {
    await openTemplateActions('E2E Minimal');
    await waitForTestId('web-template-visibility-toggle', {timeout: 10000});
    await byTestId('web-template-visibility-toggle').click();
    await waitForTestId('web-template-visibility-dialog');
    await captureStep({
      surface: 'web',
      label: 'visibility-dialog',
    });
    await browser.keys('Escape');
  });

  it('should show archive template control', async () => {
    await openTemplateActions('E2E Minimal');
    await waitForTestId('web-template-archive-button', {timeout: 10000});
    await expect(byTestId('web-template-archive-button')).toBeDisplayed();
    await byTestId('web-template-archive-button').click();
    await waitForTestId('web-template-archive-dialog');
    await captureStep({
      surface: 'web',
      label: 'archive-dialog',
    });
    await browser.keys('Escape');
  });
});

describe('Web — Archive nav (templates)', () => {
  before(async () => {
    await browser.reloadSession();
    await loginWebPersona('operationsAdmin');
  });

  it('should reach archive page from sidebar', async () => {
    await waitForTestId('web-nav-archive');
    await byTestId('web-nav-archive').click();
    await browser.waitUntil(
      async () => (await browser.getUrl()).includes('/archive'),
      {timeout: 10000}
    );
    await captureStep({surface: 'web', label: 'archive-nav'});
  });
});
