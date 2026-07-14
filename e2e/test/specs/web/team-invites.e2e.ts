/**
 * Tier 2 stubs — invites / archive / sync.
 * Workflows: T7, T8, P4, P13, P14, A1, TP9, TP10, A2, S1, S2, S5
 */
import {loginWebPersona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';
import {getWebUrl} from '../../helpers/env.ts';

describe('Tier 2 — Team invites (T7/T8)', () => {
  before(async () => {
    await browser.reloadSession();
    await loginWebPersona('managerBlue');
  });

  it('should open Blue Team Invites tab', async () => {
    await browser.url(`${getWebUrl()}/teams`);
    await waitForTestId('web-teams-heading');
    const search = byTestId('web-data-table-search');
    if (await search.isExisting()) {
      await search.setValue('Blue');
    }
    // Teams list uses row click (no <a> in the table)
    const row = await $('tbody tr');
    await row.waitForClickable({timeout: 10000});
    await row.click();
    await browser.waitUntil(
      async () => (await browser.getUrl()).includes('/teams/'),
      {timeout: 10000}
    );
    const invitesTab = await $('button*=Invites');
    await invitesTab.waitForClickable({timeout: 10000});
    await invitesTab.click();
    await captureStep({
      surface: 'web',
      workflowId: 'T7',
      label: 'team-invites',
    });
  });
});

describe('Tier 2 — Archive nav (A1/A2)', () => {
  before(async () => {
    await browser.reloadSession();
    await loginWebPersona('operationsAdmin');
  });

  it('should navigate to archive via sidebar', async () => {
    await waitForTestId('web-nav-archive');
    await byTestId('web-nav-archive').click();
    await browser.waitUntil(
      async () => (await browser.getUrl()).includes('/archive'),
      {timeout: 10000}
    );
    await captureStep({surface: 'web', workflowId: 'A1', label: 'archive'});
  });
});
