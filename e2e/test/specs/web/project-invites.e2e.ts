/**
 * Project invites tab + create invite dialog (managerBlue / Blue notebook).
 */
import {loginWebPersona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';
import {getWebUrl} from '../../helpers/env.ts';

async function openFirstProject() {
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

describe('Web — Project invites', () => {
  const inviteName = `E2E Proj Invite ${Date.now()}`;

  before(async () => {
    await browser.reloadSession();
    await loginWebPersona('managerBlue');
  });

  it('should open Invites tab and create a project invite', async () => {
    await openFirstProject();
    const invitesTab = await $('button*=Invites');
    await invitesTab.waitForClickable({timeout: 10000});
    await invitesTab.click();

    await waitForTestId('web-project-invite-create-button', {timeout: 10000});
    await byTestId('web-project-invite-create-button').click();
    await waitForTestId('web-project-invite-create-dialog');
    await byTestId('web-project-invite-create-name').setValue(inviteName);

    const roleTrigger = await $(
      '[data-testid="web-project-invite-create-dialog"] button[role="combobox"]'
    );
    if (await roleTrigger.isExisting()) {
      await roleTrigger.click();
      const roleOpt = await $('div[role="option"]');
      await roleOpt.waitForClickable({timeout: 5000});
      await roleOpt.click();
    }

    await selectFirstExpiryHint();
    await clickInviteSubmit('web-project-invite-create-submit');

    await browser.waitUntil(
      async () => {
        const dialogGone = !(await byTestId('web-project-invite-create-dialog')
          .isDisplayed()
          .catch(() => false));
        const listed = (await $('main').getText()).includes(inviteName);
        return dialogGone && listed;
      },
      {
        timeout: 20000,
        timeoutMsg: `Expected invite "${inviteName}" in project invites table`,
      }
    );
    await captureStep({
      surface: 'web',
      label: 'project-invite-created',
    });
  });
});
