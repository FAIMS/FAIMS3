/**
 * Workflows: C6, C7, C8
 * Forgot-password form + admin-generated reset link (no mail catcher).
 * Requires RATE_LIMITER_ENABLED=false in api/.env for repeated local runs.
 */
import {loginWebPersona, persona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';
import {getConductorUrl} from '../../helpers/env.ts';
import {
  completePasswordReset,
  requestPasswordResetLink,
} from '../../helpers/seed.ts';

describe('Tier 3 — Conductor password reset (C6–C8)', () => {
  const target = persona('user');
  const tempPassword = `TempReset${Date.now()}!`;
  let resetUrl = '';

  it('C6: should show and submit forgot-password form', async () => {
    await browser.reloadSession();
    await browser.url(`${getConductorUrl()}/forgot-password`);
    await waitForTestId('conductor-forgot-form');
    await expect(byTestId('conductor-forgot-email-input')).toBeDisplayed();
    await expect(byTestId('conductor-forgot-submit')).toBeDisplayed();
    await byTestId('conductor-forgot-email-input').setValue(target.email);
    await byTestId('conductor-forgot-submit').click();
    await captureStep({
      surface: 'conductor',
      workflowId: 'C6',
      label: 'forgot-form',
    });
  });

  it('C7: admin generates reset URL via API', async () => {
    await browser.reloadSession();
    await loginWebPersona('operationsAdmin');
    const {url} = await requestPasswordResetLink(target.email);
    resetUrl = url;
    expect(resetUrl).toContain('reset-password');
    await captureStep({
      surface: 'web',
      workflowId: 'C7',
      label: 'reset-url-issued',
    });
  });

  it('C8: should complete reset with admin-issued link and restore password', async () => {
    expect(resetUrl.length).toBeGreaterThan(0);
    await browser.url(resetUrl);
    await waitForTestId('conductor-reset-form');
    await byTestId('conductor-reset-new-password').setValue(tempPassword);
    await byTestId('conductor-reset-confirm-password').setValue(tempPassword);
    await byTestId('conductor-reset-submit').click();

    await browser.waitUntil(
      async () => {
        const url = await browser.getUrl();
        const success = await byTestId('conductor-reset-success')
          .isExisting()
          .catch(() => false);
        return success || !url.includes('reset-password');
      },
      {timeout: 20000, timeoutMsg: 'Expected password reset to complete'}
    );
    await captureStep({
      surface: 'conductor',
      workflowId: 'C8',
      label: 'reset-complete',
    });

    // Restore original seed password for later suites.
    await browser.reloadSession();
    await loginWebPersona('operationsAdmin');
    const {code} = await requestPasswordResetLink(target.email);
    await completePasswordReset(code, target.password);
  });
});
