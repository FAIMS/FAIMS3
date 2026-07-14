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

/**
 * Role values offered by the create-invite dialog.
 *
 * Prefer Radix's mirrored native <select> (always in the DOM, stable values)
 * over getText() on portal options — visible-text scraping races the open
 * animation and caused a CI flake where Team Administrator was on screen but
 * labels.some(/team admin/i) was false.
 */
async function getInviteRoleValues(): Promise<string[]> {
  await byTestId('web-team-invite-create-button').click();
  await waitForTestId('web-team-invite-create-dialog');

  await browser.waitUntil(
    async () => {
      const values = await readNativeSelectRoleValues();
      return values.length > 0;
    },
    {
      timeout: 5000,
      timeoutMsg: 'Expected invite role options in create dialog',
    }
  );

  // Open the combobox for the step screenshot (visual evidence of filtering).
  const roleTrigger = await $(
    '[data-testid="web-team-invite-create-dialog"] button[role="combobox"]'
  );
  await roleTrigger.waitForClickable({timeout: 10000});
  await roleTrigger.click();
  await browser.waitUntil(
    async () => (await $$('div[role="option"]').length) > 0,
    {timeout: 5000}
  );

  return readNativeSelectRoleValues();
}

async function readNativeSelectRoleValues(): Promise<string[]> {
  return browser.execute(() => {
    const dialog = document.querySelector(
      '[data-testid="web-team-invite-create-dialog"]'
    );
    const select = dialog?.querySelector('select');
    if (!select) {
      return [];
    }
    return Array.from(select.options)
      .map(o => o.value)
      .filter(v => v.length > 0);
  });
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

    const roles = await getInviteRoleValues();
    expect(roles).toContain('TEAM_MEMBER');
    expect(roles).toContain('TEAM_MANAGER');
    expect(roles).not.toContain('TEAM_ADMIN');
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

    const roles = await getInviteRoleValues();
    expect(roles).toContain('TEAM_ADMIN');
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
