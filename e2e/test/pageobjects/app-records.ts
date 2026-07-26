import {browser} from '@wdio/globals';
import {Page} from './page.ts';
import {getAppUrl, SEED_NOTEBOOK} from '../helpers/env.ts';
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
   * When `projectId` is set, targets that seed notebook specifically.
   */
  async ensureNotebookOpen(projectId: string = SEED_NOTEBOOK.red) {
    await AppNotebooksPage.open();
    await AppNotebooksPage.waitForWorkspace();

    const targetRow = () => AppNotebooksPage.notebookRowByProjectId(projectId);

    // Prefer an already-active matching notebook
    const activeEnabled = await AppNotebooksPage.activeTab
      .isEnabled()
      .catch(() => false);
    if (activeEnabled) {
      await AppNotebooksPage.activeTab.click();
      const row = targetRow();
      if (await row.isExisting()) {
        await row.click();
        await waitForUrl(new RegExp(`/surveys/[^/]+/${projectId}`), {
          timeout: 15000,
        });
        return;
      }
    }

    await AppNotebooksPage.openNotActiveTab();
    const activateOnRow = await targetRow().$(
      '[data-testid="app-notebook-activate-button"]'
    );
    if (await activateOnRow.isExisting()) {
      await activateOnRow.waitForClickable({timeout: 15000});
      await activateOnRow.click();
    } else {
      // Fallback: first activate control (single-notebook personas)
      await AppNotebooksPage.activateButton.waitForClickable({timeout: 15000});
      await AppNotebooksPage.activateButton.click();
    }
    await waitForTestId('app-notebook-activate-confirm', {timeout: 10000});
    await byTestId('app-notebook-activate-confirm').click();

    // Activation switches to Active tab
    await browser.waitUntil(
      async () => {
        const row = targetRow();
        return (
          (await AppNotebooksPage.activeTab.isEnabled().catch(() => false)) &&
          (await row.isExisting())
        );
      },
      {
        timeout: 20000,
        timeoutMsg: `Expected activated notebook row ${projectId} on Active tab`,
      }
    );

    await targetRow().click();
    await waitForUrl(new RegExp(`/surveys/[^/]+/${projectId}`), {
      timeout: 15000,
    });
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

  /** Filter the record list/search by text when the control exists. */
  async filterRecordsByText(text: string) {
    const search = byTestId('record-search-input');
    if (!(await search.isExisting())) return;
    const input = await search.$('input');
    if (!(await input.isExisting())) return;
    await input.waitForDisplayed({timeout: 5000});
    await input.setValue(text);
  }

  /**
   * Open an existing record whose list row contains `text` (HRID / notes)
   * and enter the edit form (list → view → Edit record).
   */
  async openRecordContaining(text: string) {
    await this.filterRecordsByText(text);
    await browser.waitUntil(
      async () => (await $('body').getText()).includes(text),
      {
        timeout: 20000,
        timeoutMsg: `Expected list to contain "${text}" before open`,
      }
    );
    // Prefer a DataGrid cell match; fall back to any clickable containing text.
    const cell = await $(`div[role="cell"]*=${text}`);
    if (await cell.isExisting()) {
      await cell.click();
    } else {
      await $(`*=${text}`).click();
    }
    await browser.waitUntil(
      async () => (await browser.getUrl()).includes('/view-record/'),
      {
        timeout: 15000,
        timeoutMsg: 'Expected navigation to view-record after list click',
      }
    );
    const editBtn = await $('button*=Edit record');
    await editBtn.waitForClickable({timeout: 15000});
    await editBtn.click();
    await waitForTestId('app-record-field-notes', {timeout: 20000});
  }

  /** Replace notes on the open record form and finish. */
  async updateOpenRecordNotes(notes: string) {
    await waitForTestId('app-record-field-notes', {timeout: 20000});
    const input = await this.notesField.$('input, textarea');
    await input.waitForDisplayed({timeout: 10000});
    await input.clearValue();
    await input.setValue(notes);
    await this.finishButton.waitForClickable({timeout: 15000});
    await this.finishButton.click();
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
