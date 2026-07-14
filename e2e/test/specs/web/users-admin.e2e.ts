/**
 * Tier 3 stubs — admin / permissions / profile tokens.
 * Workflows: U1–U5, PR1–PR3, T11
 *
 * Deeper matrix / exports / offline / password-reset deferred:
 * - exports.e2e.ts — needs download prefs
 * - offline-map-region / offline-collect — CDP offline limited under Classic
 * - password-reset — needs mail catcher or admin API link
 * - SSO — skip until mock IdP
 */
import {loginWebPersona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';
import {getWebUrl} from '../../helpers/env.ts';

describe('Tier 3 — Users admin (U1)', () => {
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
    await captureStep({surface: 'web', workflowId: 'U1', label: 'users-admin'});
  });
});

describe('Tier 3 — Profile tokens link (PR1)', () => {
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
    await captureStep({
      surface: 'web',
      workflowId: 'PR1',
      label: 'profile-tokens',
    });
  });
});
