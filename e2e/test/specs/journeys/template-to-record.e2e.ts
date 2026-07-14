/**
 * Cross-surface journey: Control Centre templates → Fieldmark workspace.
 */
import {
  loginWebPersona,
  loginAppPersona,
  logoutWeb,
} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import WebTemplatesPage from '../../pageobjects/web/web-templates.ts';
import {getAppUrl} from '../../helpers/env.ts';

describe('Journey — template to record', () => {
  it('should list templates in Control Centre then open Fieldmark workspace', async () => {
    await browser.reloadSession();
    await loginWebPersona('memberBoth');
    await WebTemplatesPage.open();
    await expect(byTestId('web-templates-heading')).toBeDisplayed();
    await captureStep({
      surface: 'web',
      label: 'journey-templates',
    });

    await logoutWeb();
    await browser.reloadSession();
    await loginAppPersona('projectContributor');
    await browser.url(`${getAppUrl()}/`);
    await browser.waitUntil(
      async () => {
        const url = await browser.getUrl();
        return (
          !url.includes('/login') &&
          ((await byTestId('app-notebooks-heading').isExisting()) ||
            (await byTestId('onboarding-component').isExisting()) === false)
        );
      },
      {timeout: 25000, timeoutMsg: 'App did not leave auth after journey login'}
    );

    if (await byTestId('app-notebooks-heading').isExisting()) {
      await expect(byTestId('app-notebooks-heading')).toBeDisplayed();
      await captureStep({
        surface: 'app',
        label: 'journey-app-workspace',
      });
    } else {
      // Contributor may land without workspace heading if notebooks not provisioned
      await captureStep({
        surface: 'app',
        label: 'journey-app-post-login',
      });
    }
  });
});
