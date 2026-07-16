/**
 * Profile long-lived API tokens: list, create, revoke.
 */
import {loginWebPersona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';
import {getWebUrl} from '../../helpers/env.ts';

async function selectFirstExpiryHint() {
  const expiry = byTestId('web-expiry-select');
  await expiry.waitForClickable({timeout: 10000});
  await expiry.click();
  const option = await $('div[role="option"]');
  await option.waitForClickable({timeout: 5000});
  await option.click();
}

async function clickSubmit(testId: string) {
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

describe('Web — Profile tokens', () => {
  const tokenTitle = `E2E Token ${Date.now()}`;
  const tokenDescription = `E2E token description ${Date.now()}`;

  before(async () => {
    await browser.reloadSession();
    await loginWebPersona('operationsAdmin');
  });

  it('should open long-lived tokens from profile', async () => {
    await browser.url(`${getWebUrl()}/profile`);
    await waitForTestId('web-profile-tokens-link');
    await byTestId('web-profile-tokens-link').click();
    await browser.waitUntil(
      async () => (await browser.getUrl()).includes('long-lived-tokens'),
      {timeout: 10000}
    );
    await waitForTestId('web-profile-tokens-heading');
    await expect(byTestId('web-profile-tokens-create-button')).toBeDisplayed();
    await expect(byTestId('web-profile-tokens-admin-mode')).toBeExisting();
    await captureStep({
      surface: 'web',
      label: 'profile-tokens',
    });
  });

  it('should create a long-lived token', async () => {
    await browser.url(`${getWebUrl()}/profile/long-lived-tokens`);
    await waitForTestId('web-profile-tokens-create-button');
    await byTestId('web-profile-tokens-create-button').click();
    await waitForTestId('web-profile-tokens-create-dialog');

    await byTestId('web-profile-tokens-create-title').setValue(tokenTitle);
    await byTestId('web-profile-tokens-create-description').setValue(
      tokenDescription
    );
    await selectFirstExpiryHint();
    await clickSubmit('web-profile-tokens-create-submit');

    await waitForTestId('web-profile-tokens-created-value', {timeout: 15000});
    const tokenText = await byTestId(
      'web-profile-tokens-created-value'
    ).getText();
    expect(tokenText.length).toBeGreaterThan(10);
    await captureStep({
      surface: 'web',
      label: 'token-created',
    });

    // Dialog content can overflow the viewport — prefer JS click.
    await browser.execute(() => {
      const el = document.querySelector(
        '[data-testid="web-profile-tokens-created-close"]'
      ) as HTMLButtonElement | null;
      el?.click();
    });
    await browser.waitUntil(
      async () => {
        const listed = (await $('main').getText()).includes(tokenTitle);
        return listed;
      },
      {
        timeout: 15000,
        timeoutMsg: `Expected token "${tokenTitle}" in tokens table`,
      }
    );
  });

  it('should revoke the created token', async () => {
    await browser.url(`${getWebUrl()}/profile/long-lived-tokens`);
    await waitForTestId('web-profile-tokens-heading');

    const search = byTestId('web-data-table-search');
    if (await search.isExisting()) {
      await search.setValue(tokenTitle);
    }

    await browser.waitUntil(
      async () => (await $('main').getText()).includes(tokenTitle),
      {timeout: 10000, timeoutMsg: 'Token row not found before revoke'}
    );

    const revoke = byTestId('web-profile-tokens-revoke-button');
    await revoke.waitForClickable({timeout: 10000});
    await revoke.click();

    // Enable "Show Revoked" so we can confirm status, or wait for row to vanish
    await browser.waitUntil(
      async () => {
        const text = await $('main').getText();
        return text.includes('Revoked') || !text.includes(tokenTitle);
      },
      {
        timeout: 15000,
        timeoutMsg:
          'Expected token to be revoked (status or removed from list)',
      }
    );
    await captureStep({
      surface: 'web',
      label: 'token-revoked',
    });
  });
});
