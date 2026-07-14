/**
 * Workflows: S1, S2, S5
 * Notebook settings: sync mode select + deactivate control (after activate).
 */
import {loginAppPersona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';
import AppRecordsPage from '../../pageobjects/app-records.ts';

describe('App — Sync settings (S1/S2/S5)', () => {
  before(async () => {
    await browser.reloadSession();
    await loginAppPersona('projectContributor');
    await AppRecordsPage.ensureNotebookOpen();
  });

  it('S1: should open Settings tab', async () => {
    await AppRecordsPage.openSettingsTab();
    await waitForTestId('app-notebook-sync-mode-select', {timeout: 10000});
    await captureStep({
      surface: 'app',
      workflowId: 'S1',
      label: 'settings-tab',
    });
  });

  it('S2: should show sync mode select', async () => {
    await expect(byTestId('app-notebook-sync-mode-select')).toBeDisplayed();
    await captureStep({
      surface: 'app',
      workflowId: 'S2',
      label: 'sync-mode-select',
    });
  });

  it('S5: should expose deactivate control (dialog only)', async () => {
    await waitForTestId('app-notebook-deactivate-button', {timeout: 10000});
    await byTestId('app-notebook-deactivate-button').click();
    await waitForTestId('app-notebook-deactivate-confirm', {timeout: 10000});
    await captureStep({
      surface: 'app',
      workflowId: 'S5',
      label: 'deactivate-dialog',
    });
    await byTestId('app-notebook-deactivate-cancel').click();
  });
});
