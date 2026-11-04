/**
 * Fieldmark contextual-layer manager. Seed has no ready map assets, so the
 * manager empty state is the expected listing and activation does not show
 * the download prompt. Prompt-on-unseen listing is covered by unit tests.
 */
import {loginAppPersona} from '../../helpers/auth.ts';
import {getAppUrl} from '../../helpers/env.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';
import AppNotebooksPage from '../../pageobjects/app-notebooks.ts';

describe('App — Contextual map layers', () => {
  before(async () => {
    await browser.reloadSession();
    await loginAppPersona('projectContributor');
  });

  it('opens the map layers manager from the offline maps chooser', async () => {
    await browser.url(`${getAppUrl()}/offline-maps`);
    await waitForTestId('offline-maps-home', {timeout: 15000});
    await byTestId('offline-maps-layers-link').click();
    await waitForTestId('map-layer-manager', {timeout: 15000});
    await expect(byTestId('map-layer-on-device-empty')).toBeDisplayed();
    await expect(byTestId('map-layer-not-downloaded-empty')).toBeDisplayed();
    await captureStep({surface: 'app', label: 'map-layers-manager-empty'});
  });

  it('does not prompt for contextual layers when activating a survey with no linked layers', async () => {
    await AppNotebooksPage.open();
    await AppNotebooksPage.waitForWorkspace();
    await AppNotebooksPage.openNotActiveTab();
    const activate = byTestId('app-notebook-activate-button');
    if (await activate.isExisting()) {
      await activate.waitForClickable({timeout: 15000});
      await activate.click();
      if (await byTestId('app-notebook-activate-confirm').isExisting()) {
        await AppNotebooksPage.confirmActivation();
      }
    }
    await expect(byTestId('map-layer-activation-prompt')).not.toBeExisting();
    await captureStep({
      surface: 'app',
      label: 'map-layers-no-activation-prompt',
    });
  });
});
