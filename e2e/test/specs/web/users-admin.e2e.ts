/**
 * Users admin: list, password-reset link, disable dialog, global invite.
 * Impersonation is covered in app/impersonation.e2e.ts.
 */
import {loginWebPersona, persona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';
import {getWebUrl} from '../../helpers/env.ts';

async function openUsersAdmin() {
  await browser.url(`${getWebUrl()}/users`);
  await browser.waitUntil(
    async () => (await browser.getUrl()).includes('/users'),
    {timeout: 10000}
  );
  await waitForTestId('web-main');
}

async function searchUsers(query: string) {
  const search = byTestId('web-data-table-search');
  await search.waitForExist({timeout: 10000});
  await search.clearValue();
  await search.setValue(query);
  // Wait until at least one data row is visible for the filter.
  await browser.waitUntil(
    async () => {
      const rows = await $$('tbody tr');
      const count = await rows.length;
      if (count === 0) return false;
      const text = await rows[0].getText();
      return text.length > 0 && !text.toLowerCase().includes('no results');
    },
    {
      timeout: 10000,
      timeoutMsg: `Expected users table to show a row matching "${query}"`,
    }
  );
}

async function clickFirstVisibleTestId(testId: string) {
  const el = byTestId(testId);
  await el.waitForExist({timeout: 15000});
  await el.scrollIntoView({block: 'center', inline: 'center'});
  try {
    await el.waitForClickable({timeout: 5000});
    await el.click();
  } catch {
    await browser.execute((id: string) => {
      const node = document.querySelector(
        `[data-testid="${id}"]`
      ) as HTMLElement | null;
      node?.click();
    }, testId);
  }
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

describe('Web — Users admin', () => {
  const target = persona('user');
  const inviteName = `E2E Global Invite ${Date.now()}`;

  before(async () => {
    await browser.reloadSession();
    await loginWebPersona('operationsAdmin');
  });

  it('should open Users admin from sidebar', async () => {
    await waitForTestId('web-nav-users');
    await byTestId('web-nav-users').click();
    await browser.waitUntil(
      async () => (await browser.getUrl()).includes('/users'),
      {timeout: 10000}
    );
    await waitForTestId('web-main');
    await captureStep({surface: 'web', label: 'users-admin'});
  });

  it('should generate password reset link for seed-user', async () => {
    await openUsersAdmin();
    await searchUsers(target.email);

    await clickFirstVisibleTestId('web-users-reset-button');

    await waitForTestId('web-users-reset-dialog');
    await byTestId('web-users-reset-generate').click();
    await waitForTestId('web-users-reset-url', {timeout: 15000});
    const urlText = await byTestId('web-users-reset-url').getText();
    expect(urlText).toContain('reset-password');
    await captureStep({
      surface: 'web',
      label: 'reset-link-dialog',
    });

    // Close dialog (Escape) without navigating away.
    await browser.keys('Escape');
  });

  it('should open disable-user dialog and cancel', async () => {
    await openUsersAdmin();
    await searchUsers(target.email);

    await clickFirstVisibleTestId('web-users-disable-button');
    await waitForTestId('web-users-disable-dialog');
    await expect(byTestId('web-users-disable-confirm')).toBeDisplayed();
    await captureStep({
      surface: 'web',
      label: 'disable-dialog',
    });
    await browser.keys('Escape');
    await browser.waitUntil(
      async () =>
        !(await byTestId('web-users-disable-dialog')
          .isDisplayed()
          .catch(() => false)),
      {timeout: 5000}
    );
  });

  it('should create a global invite', async () => {
    await openUsersAdmin();
    const invitesTab = await $('button*=Invites');
    await invitesTab.waitForClickable({timeout: 10000});
    await invitesTab.click();

    await waitForTestId('web-global-invite-create-button', {timeout: 10000});
    await byTestId('web-global-invite-create-button').click();
    await waitForTestId('web-global-invite-create-dialog');
    await byTestId('web-global-invite-create-name').setValue(inviteName);

    const roleTrigger = await $(
      '[data-testid="web-global-invite-create-dialog"] button[role="combobox"]'
    );
    if (await roleTrigger.isExisting()) {
      await roleTrigger.click();
      // Prefer General Creator if listed; otherwise first option.
      const creator = await $('div[role="option"]*=Creator');
      if (await creator.isExisting()) {
        await creator.click();
      } else {
        const roleOpt = await $('div[role="option"]');
        await roleOpt.waitForClickable({timeout: 5000});
        await roleOpt.click();
      }
    }

    await selectFirstExpiryHint();
    await clickInviteSubmit('web-global-invite-create-submit');

    await browser.waitUntil(
      async () => {
        const dialogGone = !(await byTestId('web-global-invite-create-dialog')
          .isDisplayed()
          .catch(() => false));
        const listed = (await $('main').getText()).includes(inviteName);
        return dialogGone && listed;
      },
      {
        timeout: 20000,
        timeoutMsg: `Expected global invite "${inviteName}" in table`,
      }
    );
    await captureStep({
      surface: 'web',
      label: 'global-invite-created',
    });
  });
});
