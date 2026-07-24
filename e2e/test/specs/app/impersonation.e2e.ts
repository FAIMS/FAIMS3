/**
 * Ops admin impersonates a seed user from the Fieldmark app menu, then returns.
 */
import {loginAppPersona, persona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForGone, waitForTestId} from '../../helpers/wait.ts';

describe('App — Impersonation', () => {
  const target = persona('user');

  before(async () => {
    await browser.reloadSession();
    await loginAppPersona('operationsAdmin');
  });

  it('should impersonate seed-user and return to admin', async () => {
    await waitForTestId('app-nav-user-menu', {timeout: 15000});
    await byTestId('app-nav-user-menu').click();
    await waitForTestId('app-nav-impersonate');
    await byTestId('app-nav-impersonate').click();
    await waitForTestId('app-impersonate-dialog');

    const search = byTestId('app-impersonate-search');
    await search.waitForDisplayed({timeout: 10000});
    await search.setValue(target.email);

    const row = await $(
      `[data-testid="app-impersonate-user-row"][data-user-id="${target.email}"]`
    );
    await row.waitForClickable({timeout: 15000});
    await row.click();

    await waitForTestId('app-impersonation-banner', {timeout: 20000});
    const bannerText = await byTestId('app-impersonation-banner').getText();
    expect(bannerText.toLowerCase()).toContain('impersonating');
    await captureStep({
      surface: 'app',
      label: 'impersonating',
    });

    await byTestId('app-impersonation-return-button').click();
    await waitForGone('app-impersonation-banner', {timeout: 15000});
    await captureStep({
      surface: 'app',
      label: 'returned',
    });
  });

  it('projectGuest has no impersonate menu', async () => {
    await browser.reloadSession();
    await loginAppPersona('projectGuest');
    await waitForTestId('app-nav-user-menu', {timeout: 15000});
    await byTestId('app-nav-user-menu').click();
    await browser.waitUntil(
      async () =>
        (await $('li').isExisting()) ||
        (await byTestId('app-nav-impersonate')
          .isExisting()
          .catch(() => false)),
      {timeout: 5000}
    );
    await expect(byTestId('app-nav-impersonate')).not.toBeExisting();
    await captureStep({
      surface: 'app',
      label: 'guest-no-impersonate',
    });
  });
});
