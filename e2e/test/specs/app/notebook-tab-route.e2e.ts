/**
 * Notebook tab lives in the route: selecting a tab puts it in the URL, that URL
 * opens the tab on its own, and a record opened from a tab nests under it so
 * leaving the record returns to that tab rather than the default one.
 */
import {loginAppPersona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId, waitForUrl} from '../../helpers/wait.ts';
import AppRecordsPage from '../../pageobjects/app-records.ts';

/** A tab that is not the notebook's default, so a dropped tab is visible. */
const OTHER_TAB = 'details';

describe('App — notebook tab in the route', () => {
  const noteText = `E2E tab route ${Date.now()}`;
  /** The notebook route with no tab segment, e.g. /surveys/<server>/<project> */
  let notebookUrl = '';
  /** A record id picked up from the record route opened during the run */
  let recordId = '';

  before(async () => {
    await browser.reloadSession();
    await loginAppPersona('projectContributor');
    await AppRecordsPage.ensureNotebookOpen();
    notebookUrl = (await browser.getUrl()).split('?')[0].replace(/\/$/, '');
  });

  it('should put the selected tab in the URL', async () => {
    await AppRecordsPage.openSettingsTab();
    await waitForUrl(`${notebookUrl}/settings`, {
      timeout: 10000,
      timeoutMsg: 'Expected the settings tab as the last path segment',
    });
    await captureStep({surface: 'app', label: 'tab-route-settings'});
  });

  it('should open a tab from its URL alone', async () => {
    await browser.url(`${notebookUrl}/settings`);
    await waitForTestId('app-notebook-tab-settings', {timeout: 20000});
    await browser.waitUntil(
      async () =>
        (await byTestId('app-notebook-tab-settings').getAttribute(
          'aria-selected'
        )) === 'true',
      {
        timeout: 15000,
        timeoutMsg: 'Expected the settings tab selected from its URL alone',
      }
    );
  });

  it('should return to the tab a record was opened from', async () => {
    await waitForTestId('app-notebook-tab-my-records', {timeout: 15000});
    await byTestId('app-notebook-tab-my-records').click();
    await waitForUrl(`${notebookUrl}/my-records`, {timeout: 10000});

    await AppRecordsPage.createTextRecord(noteText);

    // Open the record from the my-records list: its route nests under the tab
    await byTestId('app-notebook-tab-my-records').click();
    await waitForUrl(`${notebookUrl}/my-records`, {timeout: 10000});
    const row = await $('.MuiDataGrid-row');
    await row.waitForClickable({timeout: 20000});
    await row.click();
    const recordUrl = await waitForUrl(
      `${notebookUrl}/my-records/view-record/`,
      {
        timeout: 20000,
        timeoutMsg: 'Expected the record route nested under the my-records tab',
      }
    );
    recordId = recordUrl.split('/view-record/')[1].replace(/[?#].*$/, '');
    await captureStep({surface: 'app', label: 'tab-route-record'});

    // Back leaves the record for the tab it was opened from
    const back = await $('[aria-label="Back"]');
    await back.waitForClickable({timeout: 15000});
    await back.click();
    await waitForUrl(
      url => url.replace(/\?.*$/, '') === `${notebookUrl}/my-records`,
      {
        timeout: 15000,
        timeoutMsg:
          'Expected back from the record to land on the my-records tab',
      }
    );
    await captureStep({surface: 'app', label: 'tab-route-back-to-list'});
  });

  it('should still resolve a record link written without a tab', async () => {
    await browser.url(`${notebookUrl}/view-record/${recordId}`);
    const back = await $('[aria-label="Back"]');
    await back.waitForClickable({timeout: 20000});
    await back.click();
    await waitForUrl(url => url.replace(/\?.*$/, '') === notebookUrl, {
      timeout: 15000,
      timeoutMsg:
        'Expected a tab-less record link to lead back to the notebook',
    });
    await waitForTestId('app-notebook-tab-my-records', {timeout: 15000});
  });

  // The steps below use `details` rather than the default tab, so a dropped tab
  // shows up as a different URL instead of the one the default would give

  it('should keep the tab when the record opens its editor', async () => {
    await browser.url(`${notebookUrl}/${OTHER_TAB}/view-record/${recordId}`);
    const edit = await $('button*=Edit record');
    await edit.waitForClickable({timeout: 20000});
    await edit.click();
    await waitForUrl(
      url =>
        url.replace(/[?#].*$/, '') ===
        `${notebookUrl}/${OTHER_TAB}/records/${recordId}`,
      {
        timeout: 20000,
        timeoutMsg: `Expected the editor route to stay under the ${OTHER_TAB} tab`,
      }
    );
    await captureStep({surface: 'app', label: 'tab-route-edit'});
  });

  it('should return to the tab after deleting the record', async () => {
    await browser.url(
      `${notebookUrl}/${OTHER_TAB}/view-record/${recordId}?tab=info`
    );
    await waitForTestId('delete-btn', {timeout: 20000});
    await byTestId('delete-btn').click();
    // The confirm button stays disabled until the acknowledgement is ticked
    const acknowledge = await $('.MuiCheckbox-root');
    await acknowledge.waitForClickable({timeout: 15000});
    await acknowledge.click();
    await waitForTestId('confirm-delete', {timeout: 15000});
    await byTestId('confirm-delete').click();
    await waitForUrl(
      url => url.replace(/[?#].*$/, '') === `${notebookUrl}/${OTHER_TAB}`,
      {
        timeout: 20000,
        timeoutMsg: `Expected a delete to land back on the ${OTHER_TAB} tab`,
      }
    );
    await captureStep({surface: 'app', label: 'tab-route-after-delete'});
  });
});
