/**
 * Notebook settings: sync mode select + deactivate control (after activate).
 */
import {loginAppPersona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';
import AppRecordsPage from '../../pageobjects/app-records.ts';

describe('App — Sync settings', () => {
  before(async () => {
    await browser.reloadSession();
    await loginAppPersona('projectContributor');
    await AppRecordsPage.ensureNotebookOpen();
  });

  it('should open Settings tab', async () => {
    await AppRecordsPage.openSettingsTab();
    await waitForTestId('app-notebook-sync-mode-select', {timeout: 10000});
    await captureStep({
      surface: 'app',
      label: 'settings-tab',
    });
  });

  it('should show sync mode select', async () => {
    await expect(byTestId('app-notebook-sync-mode-select')).toBeDisplayed();
    await captureStep({
      surface: 'app',
      label: 'sync-mode-select',
    });
  });

  it('should expose deactivate control (dialog only)', async () => {
    await waitForTestId('app-notebook-deactivate-button', {timeout: 10000});
    await byTestId('app-notebook-deactivate-button').click();
    await waitForTestId('app-notebook-deactivate-confirm', {timeout: 10000});
    await captureStep({
      surface: 'app',
      label: 'deactivate-dialog',
    });
    await byTestId('app-notebook-deactivate-cancel').click();
  });
});
