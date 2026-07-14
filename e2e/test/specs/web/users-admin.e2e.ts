/**
 * Tier 3 — Users admin (U1)
 * Workflows: U1 (deeper U2–U5 / global invites deferred)
 */
import {loginWebPersona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';

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
    await waitForTestId('web-main');
    await captureStep({surface: 'web', workflowId: 'U1', label: 'users-admin'});
  });
});
