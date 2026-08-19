import {$, browser} from '@wdio/globals';
import {Page} from './page.ts';
import {getAppUrl} from '../helpers/env.ts';
import {
  DEFAULT_TEST_COORDS,
  stubGeolocation,
  type TestCoords,
} from '../helpers/stubLocation.ts';
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

  /** Overview map tab of the open notebook. */
  get mapTab() {
    return byTestId('app-notebook-tab-map');
  }

  /**
   * Capture-current-location button of the e2e-minimal notebook's TakePoint
   * field. Matched on the fixture's `buttonLabelText` so the selector does not
   * depend on the field's own label.
   */
  get takePointButton() {
    return $('button*=Take Point');
  }

  /** Open the notebook overview map tab and wait for the map to mount. */
  async openMapTab() {
    await this.mapTab.waitForClickable({timeout: 15000});
    await this.mapTab.click();
  }

  /**
   * Create a record carrying both a note and a captured point, then finish it.
   *
   * Geolocation is stubbed before the capture click because headless Chrome has
   * no location provider; see {@link stubGeolocation}.
   */
  async createRecordWithPoint(
    notes: string,
    coords: TestCoords = DEFAULT_TEST_COORDS
  ) {
    await this.addButton.waitForClickable({timeout: 15000});
    await this.addButton.click();
    await waitForTestId('app-record-field-notes', {timeout: 20000});

    const input = await this.notesField.$('input, textarea');
    await input.waitForDisplayed({timeout: 10000});
    await input.setValue(notes);

    await stubGeolocation(coords);
    await this.takePointButton.waitForClickable({timeout: 15000});
    await this.takePointButton.click();

    // TakePoint renders a "Captured Location" panel with each ordinate at
    // toFixed(6); waiting on the exact stubbed latitude keeps this from
    // passing on unrelated numbers that were already on the page.
    const expectedLatitude = coords.latitude.toFixed(6);
    await browser.waitUntil(
      async () => {
        const body = await $('body').getText();
        return (
          body.includes('Captured Location') && body.includes(expectedLatitude)
        );
      },
      {
        timeout: 20000,
        timeoutMsg: `Expected captured latitude ${expectedLatitude} on the record form`,
      }
    );

    await this.finishButton.waitForClickable({timeout: 15000});
    await this.finishButton.click();
    // Bounded wait rather than an instant isExisting(): the validation dialog
    // renders a beat after the click, and missing it strands the URL wait below.
    const finishAnyway = await $('button*=Finish anyway');
    if (await finishAnyway.waitForExist({timeout: 3000}).catch(() => false)) {
      await finishAnyway.click();
    }
    await browser.waitUntil(
      async () => (await browser.getUrl()).includes('/surveys/'),
      {timeout: 20000, timeoutMsg: 'Expected return to notebook after finish'}
    );
  }
}

export default new AppRecordsPage();
