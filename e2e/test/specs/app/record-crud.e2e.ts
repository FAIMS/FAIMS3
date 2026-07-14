/**
 * Workflows: N8, N9, N11, N12
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

  it('N8: should open an activated notebook', async () => {
    await expect(byTestId('app-record-add-button')).toBeDisplayed();
    await captureStep({
      surface: 'app',
      workflowId: 'N8',
      label: 'notebook-opened',
    });
  });

  it('N9: should show add-record control', async () => {
    await expect(byTestId('app-record-add-button')).toBeDisplayed();
    await captureStep({
      surface: 'app',
      workflowId: 'N9',
      label: 'add-record-button',
    });
  });

  it('N11: should create a text record and finish', async () => {
    await AppRecordsPage.createTextRecord(noteText);
    await captureStep({
      surface: 'app',
      workflowId: 'N11',
      label: 'record-created',
    });
  });

  it('N12: should show the new record in the list/search', async () => {
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
      workflowId: 'N12',
      label: 'record-listed',
    });
  });
});
