/**
 * Forgot-password form + admin-generated reset link (no mail catcher).
 * Requires AUTH_ATTEMPT_LIMITER_ENABLED=false (and usually
 * RATE_LIMITER_ENABLED=false) in api/.env for repeated local runs.
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

describe('Conductor — Password reset', () => {
  const target = persona('user');
  const tempPassword = `TempReset${Date.now()}!`;
  let resetUrl = '';

  it('should show and submit forgot-password form', async () => {
    await browser.reloadSession();
    await browser.url(`${getConductorUrl()}/forgot-password`);
    await waitForTestId('conductor-forgot-form');
    await expect(byTestId('conductor-forgot-email-input')).toBeDisplayed();
    await expect(byTestId('conductor-forgot-submit')).toBeDisplayed();
    await byTestId('conductor-forgot-email-input').setValue(target.email);
    await byTestId('conductor-forgot-submit').click();
    await captureStep({
      surface: 'conductor',
      label: 'forgot-form',
    });
  });

  it('admin generates reset URL via API', async () => {
    await browser.reloadSession();
    await loginWebPersona('operationsAdmin');
    const {url} = await requestPasswordResetLink(target.email);
    resetUrl = url;
    expect(resetUrl).toContain('reset-password');
    await captureStep({
      surface: 'web',
      label: 'reset-url-issued',
    });
  });

  it('should complete reset with admin-issued link and restore password', async () => {
    expect(resetUrl.length).toBeGreaterThan(0);
    await browser.url(resetUrl);
    await waitForTestId('conductor-reset-form');
    await byTestId('conductor-reset-new-password').setValue(tempPassword);
    await byTestId('conductor-reset-confirm-password').setValue(tempPassword);
    await byTestId('conductor-reset-submit').click();

    try {
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
        label: 'reset-complete',
      });
    } finally {
      // Restore original seed password for later suites — even if the
      // wait/capture above fails and leaves the persona on tempPassword.
      await browser.reloadSession();
      await loginWebPersona('operationsAdmin');
      const {code} = await requestPasswordResetLink(target.email);
      await completePasswordReset(code, target.password);
    }
  });
});
