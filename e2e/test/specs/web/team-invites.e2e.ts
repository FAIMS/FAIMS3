/**
 * Team invites tab + create invite dialog (managerBlue).
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

async function selectFirstExpiryHint() {
  const expiry = byTestId('web-expiry-select');
  await expiry.waitForClickable({timeout: 10000});
  await expiry.click();
  const option = await $('div[role="option"]');
  await option.waitForClickable({timeout: 5000});
  await option.click();
}

async function clickInviteSubmit(testId: string) {
  const submit = byTestId(testId);
  await submit.waitForExist({timeout: 10000});
  // Dialog is tall (expiry UI); scroll submit into view then click via JS if needed
  await submit.scrollIntoView({block: 'center'});
  try {
    await submit.waitForClickable({timeout: 5000});
    await submit.click();
  } catch {
    await browser.execute((id: string) => {
      const el = document.querySelector(
        `[data-testid="${id}"]`
      ) as HTMLButtonElement | null;
      el?.click();
    }, testId);
  }
}

describe('Web — Team invites', () => {
  const inviteName = `E2E Team Invite ${Date.now()}`;

  before(async () => {
    await browser.reloadSession();
    await loginWebPersona('managerBlue');
  });

  it('should open Blue Team Invites tab', async () => {
    await openBlueTeam();
    const invitesTab = await $('button*=Invites');
    await invitesTab.waitForClickable({timeout: 10000});
    await invitesTab.click();
    await waitForTestId('web-team-invite-create-button', {timeout: 10000});
    await captureStep({
      surface: 'web',
      label: 'team-invites',
    });
  });

  it('should create a team invite', async () => {
    await openBlueTeam();
    const invitesTab = await $('button*=Invites');
    await invitesTab.waitForClickable({timeout: 10000});
    await invitesTab.click();

    await byTestId('web-team-invite-create-button').click();
    await waitForTestId('web-team-invite-create-dialog');
    await byTestId('web-team-invite-create-name').setValue(inviteName);

    const roleTrigger = await $(
      '[data-testid="web-team-invite-create-dialog"] button[role="combobox"]'
    );
    if (await roleTrigger.isExisting()) {
      await roleTrigger.click();
      const roleOpt = await $('div[role="option"]');
      await roleOpt.waitForClickable({timeout: 5000});
      await roleOpt.click();
    }

    await selectFirstExpiryHint();
    await clickInviteSubmit('web-team-invite-create-submit');

    await browser.waitUntil(
      async () => {
        const dialogGone = !(await byTestId('web-team-invite-create-dialog')
          .isDisplayed()
          .catch(() => false));
        const listed = (await $('main').getText()).includes(inviteName);
        return dialogGone && listed;
      },
      {
        timeout: 20000,
        timeoutMsg: `Expected invite "${inviteName}" in team invites table`,
      }
    );
    await captureStep({
      surface: 'web',
      label: 'team-invite-created',
    });
  });
});
