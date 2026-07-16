/**
 * Activate seeded Red notebook, create a text record, return to list.
 */
import {loginAppPersona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import AppRecordsPage from '../../pageobjects/app-records.ts';

describe('App — Record CRUD', () => {
  const noteText = `E2E note ${Date.now()}`;

  before(async () => {
    await browser.reloadSession();
    await loginAppPersona('projectContributor');
    await AppRecordsPage.ensureNotebookOpen();
  });

  it('should open an activated notebook', async () => {
    await expect(AppRecordsPage.addButton).toBeDisplayed();
    await captureStep({
      surface: 'app',
      label: 'notebook-opened',
    });
  });

  it('should show add-record control', async () => {
    await expect(AppRecordsPage.addButton).toBeDisplayed();
    await captureStep({
      surface: 'app',
      label: 'add-record-button',
    });
  });

  it('should create a text record and finish', async () => {
    await AppRecordsPage.createTextRecord(noteText);
    await captureStep({
      surface: 'app',
      label: 'record-created',
    });
  });

  it('should show the new record in the list/search', async () => {
    const search = byTestId('record-search-input');
    if (await search.isExisting()) {
      const input = await search.$('input');
      await input.waitForDisplayed({timeout: 5000});
      await input.setValue(noteText);
    }
    await browser.waitUntil(
      async () => {
        const body = await $('body').getText();
        return body.includes(noteText) || body.includes(noteText.slice(0, 12));
      },
      {
        timeout: 20000,
        timeoutMsg: `Expected record containing "${noteText}" in notebook list`,
      }
    );
    await captureStep({
      surface: 'app',
      label: 'record-listed',
    });
  });
});
