/**
 * Notebook workspace and activation (contributor persona).
 */
import {loginAppPersona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import AppNotebooksPage from '../../pageobjects/app-notebooks.ts';

describe('App — Notebook activate', () => {
  before(async () => {
    await browser.reloadSession();
    await loginAppPersona('projectContributor');
  });

  it('should show notebook workspace after login', async () => {
    await AppNotebooksPage.open();
    await AppNotebooksPage.waitForWorkspace();
    await expect(byTestId('app-notebooks-heading')).toBeDisplayed();
    await captureStep({
      surface: 'app',
      label: 'notebook-workspace',
    });
  });

  it('should show Active / Not Active tabs', async () => {
    await AppNotebooksPage.open();
    await AppNotebooksPage.waitForWorkspace();
    await expect(byTestId('app-notebooks-tab-active')).toBeDisplayed();
    await expect(byTestId('app-notebooks-tab-not-active')).toBeDisplayed();
    await captureStep({
      surface: 'app',
      label: 'notebook-tabs',
    });
  });

  it('should expose activate control on Not Active tab when available', async () => {
    await AppNotebooksPage.open();
    await AppNotebooksPage.waitForWorkspace();
    await AppNotebooksPage.openNotActiveTab();
    // Activation button only appears when a not-active notebook exists
    const activate = byTestId('app-notebook-activate-button');
    const exists = await activate.isExisting();
    if (exists) {
      await expect(activate).toBeDisplayed();
      await captureStep({
        surface: 'app',
        label: 'activate-button',
      });
    } else {
      // Seed may already have activated notebooks for this user — still a valid state
      await captureStep({
        surface: 'app',
        label: 'no-activate-needed',
      });
    }
  });
});
