/**
 * Permission-filtered UI: invite role options and create controls by persona.
 */
import {loginWebPersona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';
import {getWebUrl} from '../../helpers/env.ts';

async function openBlueTeam() {
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
}

async function openInviteRoleOptions() {
  await byTestId('web-team-invite-create-button').click();
  await waitForTestId('web-team-invite-create-dialog');
  const roleTrigger = await $(
    '[data-testid="web-team-invite-create-dialog"] button[role="combobox"]'
  );
  await roleTrigger.waitForClickable({timeout: 10000});
  await roleTrigger.click();
  await browser.waitUntil(
    async () => {
      const count = await $$('div[role="option"]').length;
      return count > 0;
    },
    {timeout: 5000}
  );
  const options = await $$('div[role="option"]');
  const labels: string[] = [];
  for (const opt of options) {
    labels.push(await opt.getText());
  }
  return labels;
}

describe('Web — Permissions matrix', () => {
  it('managerBlue: team invite roles exclude Team Admin', async () => {
    await browser.reloadSession();
    await loginWebPersona('managerBlue');
    await openBlueTeam();
    const invitesTab = await $('button*=Invites');
    await invitesTab.waitForClickable({timeout: 10000});
    await invitesTab.click();
    await waitForTestId('web-team-invite-create-button');

    const labels = await openInviteRoleOptions();
    expect(labels.some(l => /team member/i.test(l))).toBe(true);
    expect(labels.some(l => /team manager/i.test(l))).toBe(true);
    expect(labels.some(l => /team admin/i.test(l))).toBe(false);
    await captureStep({
      surface: 'web',
      label: 'manager-invite-roles',
    });
  });

  it('operationsAdmin: team invite roles include Team Admin', async () => {
    await browser.reloadSession();
    await loginWebPersona('operationsAdmin');
    await openBlueTeam();
    const invitesTab = await $('button*=Invites');
    await invitesTab.waitForClickable({timeout: 10000});
    await invitesTab.click();
    await waitForTestId('web-team-invite-create-button');

    const labels = await openInviteRoleOptions();
    expect(labels.some(l => /team admin/i.test(l))).toBe(true);
    await captureStep({
      surface: 'web',
      label: 'ops-invite-roles',
    });
  });

  it('memberBoth: Invites tab is hidden (no VIEW_TEAM_INVITES)', async () => {
    await browser.reloadSession();
    await loginWebPersona('memberBoth');
    await openBlueTeam();
    await waitForTestId('web-main');
    const invitesTab = await $('button*=Invites');
    await expect(invitesTab).not.toBeExisting();
    await captureStep({
      surface: 'web',
      label: 'member-no-invites-tab',
    });
  });

  it('projectGuest: no projects create / users nav', async () => {
    await browser.reloadSession();
    await loginWebPersona('projectGuest');
    await browser.url(`${getWebUrl()}/projects`);
    await waitForTestId('web-main', {timeout: 15000});
    await expect(byTestId('web-projects-create-button')).not.toBeExisting();
    await expect(byTestId('web-nav-users')).not.toBeExisting();
    await captureStep({
      surface: 'web',
      label: 'guest-no-create',
    });
  });
});
