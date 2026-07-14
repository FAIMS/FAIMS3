/**
 * Workflows: P13, P14, A1
 * Project Actions: close/reopen (managerBlue = PROJECT_MANAGER via team).
 * Archive control requires PROJECT_ADMIN — use operationsAdmin for P14.
 */
import {loginWebPersona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';
import {getWebUrl} from '../../helpers/env.ts';

async function openBlueProjectActions() {
  await browser.url(`${getWebUrl()}/projects`);
  await waitForTestId('web-projects-heading', {timeout: 15000});
  const search = byTestId('web-data-table-search');
  if (await search.isExisting()) {
    await search.setValue('Blue');
  }
  const row = await $('tbody tr');
  await row.waitForClickable({timeout: 15000});
  await row.click();
  await browser.waitUntil(
    async () => (await browser.getUrl()).match(/\/projects\/[^/]+/) !== null,
    {timeout: 10000}
  );
  const actionsTab = await $('button*=Actions');
  await actionsTab.waitForClickable({timeout: 10000});
  await actionsTab.click();
}

describe('Tier 2 — Project status (P13)', () => {
  before(async () => {
    await browser.reloadSession();
    await loginWebPersona('managerBlue');
  });

  it('P13: should close then reopen the project', async () => {
    await openBlueProjectActions();
    await waitForTestId('web-project-status-close', {timeout: 10000});
    await byTestId('web-project-status-close').click();
    await waitForTestId('web-project-status-close-dialog');
    await byTestId('web-project-status-close-confirm').click();
    await waitForTestId('web-project-status-reopen', {timeout: 15000});
    await captureStep({
      surface: 'web',
      workflowId: 'P13',
      label: 'project-closed',
    });

    await byTestId('web-project-status-reopen').click();
    await waitForTestId('web-project-status-reopen-dialog');
    await byTestId('web-project-status-reopen-confirm').click();
    await waitForTestId('web-project-status-close', {timeout: 15000});
    await captureStep({
      surface: 'web',
      workflowId: 'P13',
      label: 'project-reopened',
    });
  });
});

describe('Tier 2 — Project archive control (P14)', () => {
  before(async () => {
    await browser.reloadSession();
    await loginWebPersona('operationsAdmin');
  });

  it('P14: ops admin (PROJECT_ADMIN on Blue) sees archive control', async () => {
    await openBlueProjectActions();
    await waitForTestId('web-project-archive-button', {timeout: 10000});
    await expect(byTestId('web-project-archive-button')).toBeDisplayed();
    await captureStep({
      surface: 'web',
      workflowId: 'P14',
      label: 'archive-control',
    });
  });
});

describe('Tier 2 — Archive nav (A1)', () => {
  before(async () => {
    await browser.reloadSession();
    await loginWebPersona('operationsAdmin');
  });

  it('A1: should navigate to archive via sidebar', async () => {
    await waitForTestId('web-nav-archive');
    await byTestId('web-nav-archive').click();
    await browser.waitUntil(
      async () => (await browser.getUrl()).includes('/archive'),
      {timeout: 10000}
    );
    await captureStep({surface: 'web', workflowId: 'A1', label: 'archive'});
  });
});
