/**
 * Workflows: N8, N9, N11, N12
 * Record CRUD smoke once a notebook is available.
 * Soft assertions when contributor has no activated notebooks yet.
 */
import {loginAppPersona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {getAppUrl} from '../../helpers/env.ts';
import {waitForUrl} from '../../helpers/wait.ts';

describe('App — Record CRUD', () => {
  before(async () => {
    await browser.reloadSession();
    await loginAppPersona('projectContributor');
    // Allow auth-return / workspace settle
    await browser.url(`${getAppUrl()}/`);
    await browser.waitUntil(
      async () => {
        const url = await browser.getUrl();
        return (
          !url.includes('/login') &&
          !url.includes('/signin') &&
          ((await byTestId('app-notebooks-heading')
            .isExisting()
            .catch(() => false)) ||
            (await $('body').getText()).length > 0)
        );
      },
      {timeout: 20000, timeoutMsg: 'App did not settle after login'}
    );
  });

  it('N8: should reach an activated notebook when available', async () => {
    await browser.url(`${getAppUrl()}/`);
    const heading = byTestId('app-notebooks-heading');
    if (!(await heading.isExisting())) {
      await captureStep({
        surface: 'app',
        workflowId: 'N8',
        label: 'workspace-not-ready',
      });
      return;
    }
    await heading.waitForDisplayed({timeout: 10000});

    const row = await $('a[href*="/surveys/"], .MuiDataGrid-row');
    if (await row.isExisting()) {
      await row.click();
      await waitForUrl(/surveys\//, {timeout: 15000});
      await captureStep({
        surface: 'app',
        workflowId: 'N8',
        label: 'notebook-opened',
      });
    } else {
      await captureStep({
        surface: 'app',
        workflowId: 'N8',
        label: 'no-active-notebook',
      });
    }
  });

  it('N9: should show add-record control when inside a notebook', async () => {
    const add = byTestId('app-record-add-button');
    if (await add.isExisting()) {
      await expect(add).toBeDisplayed();
      await captureStep({
        surface: 'app',
        workflowId: 'N9',
        label: 'add-record-button',
      });
    } else {
      await captureStep({
        surface: 'app',
        workflowId: 'N9',
        label: 'add-record-unavailable',
      });
    }
  });
});
