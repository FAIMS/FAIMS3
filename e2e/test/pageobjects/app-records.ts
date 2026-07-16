import {browser} from '@wdio/globals';
import {Page} from './page.ts';
import {getAppUrl} from '../helpers/env.ts';
import {byTestId} from '../helpers/selectors.ts';
import {waitForTestId, waitForUrl} from '../helpers/wait.ts';
import AppNotebooksPage from './app-notebooks.ts';

/**
 * Fieldmark record create / finish helpers.
 */
class AppRecordsPage extends Page {
  /**
   * Add / new record control for a specific viewset (record type).
   * Matches `data-testid="{viewsetName}-app-record-add-button"`.
   */
  addButtonFor(viewsetName: string) {
    return byTestId(`${viewsetName}-app-record-add-button`);
  }

  /**
   * Add / new record control for the e2e-minimal notebook (`Main` viewset).
   */
  get addButton() {
    return this.addButtonFor('Main');
  }

  /** Finish / save record control. */
  get finishButton() {
    return byTestId('app-record-finish-button');
  }

  /** Notes text field on the e2e-minimal notebook form. */
  get notesField() {
    return byTestId('app-record-field-notes');
  }

  /** Record list search input. */
  get searchInput() {
    return byTestId('record-search-input');
  }

  /**
   * Activate first available notebook (if needed) and open it.
   */
  async ensureNotebookOpen() {
    await AppNotebooksPage.open();
    await AppNotebooksPage.waitForWorkspace();

    // Prefer an already-active notebook
    const activeEnabled = await AppNotebooksPage.activeTab
      .isEnabled()
      .catch(() => false);
    if (activeEnabled) {
      await AppNotebooksPage.activeTab.click();
      const row = byTestId('app-notebook-row');
      if (await row.isExisting()) {
        await row.click();
        await waitForUrl(/\/surveys\//, {timeout: 15000});
        return;
      }
    }

    await AppNotebooksPage.activateFirstAvailable();
    await waitForTestId('app-notebook-activate-confirm', {timeout: 10000});
    await byTestId('app-notebook-activate-confirm').click();

    // Activation switches to Active tab
    await browser.waitUntil(
      async () => {
        const row = byTestId('app-notebook-row');
        return (
          (await AppNotebooksPage.activeTab.isEnabled().catch(() => false)) &&
          (await row.isExisting())
        );
      },
      {
        timeout: 20000,
        timeoutMsg: 'Expected activated notebook row on Active tab',
      }
    );

    await byTestId('app-notebook-row').click();
    await waitForUrl(/\/surveys\//, {timeout: 15000});
  }

  /** Open the notebook Settings tab. */
  async openSettingsTab() {
    await waitForTestId('app-notebook-tab-settings', {timeout: 10000});
    await byTestId('app-notebook-tab-settings').click();
  }

  /**
   * Create a record with the given notes text and finish it.
   * Handles optional "Finish anyway" validation dialogs.
   */
  async createTextRecord(notes: string) {
    await this.addButton.waitForClickable({timeout: 15000});
    await this.addButton.click();
    await waitForUrl(/\/new|\/records?\//i, {timeout: 20000}).catch(
      async () => {
        // Some routes use /surveys/.../create or similar — wait for field instead
        await waitForTestId('app-record-field-notes', {timeout: 20000});
      }
    );
    await waitForTestId('app-record-field-notes', {timeout: 20000});
    const input = await this.notesField.$('input, textarea');
    await input.waitForDisplayed({timeout: 10000});
    await input.setValue(notes);
    await this.finishButton.waitForClickable({timeout: 15000});
    await this.finishButton.click();
    // Confirm finish-anyway dialog if validation warns
    const finishAnyway = await $('button*=Finish anyway');
    if (await finishAnyway.isExisting()) {
      await finishAnyway.click();
    }
    await browser.waitUntil(
      async () => (await browser.getUrl()).includes('/surveys/'),
      {timeout: 20000, timeoutMsg: 'Expected return to notebook after finish'}
    );
  }

  /** Navigate to the app root without waiting for workspace readiness. */
  async openFromAppRoot() {
    await browser.url(`${getAppUrl()}/`);
    await this.setBrowserSize();
  }
}

export default new AppRecordsPage();
