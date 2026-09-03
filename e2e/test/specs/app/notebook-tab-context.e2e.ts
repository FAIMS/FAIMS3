/**
 * Notebook tab lives in context, not the route: selecting a tab leaves the URL
 * alone, and the record routes under the notebook name no tab, so a record
 * opened from a list returns to that list on the way out, by Back or by delete.
 *
 * Every step here navigates by clicking, since loading a URL afresh is what
 * drops the context. That a tab the user picked survives the record screen
 * mounting over it is pinned by `notebookViewTab.test.tsx`.
 *
 * The editor test runs last: the editor carries no Back control, so nothing can
 * follow it.
 */
import {loginAppPersona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId, waitForUrl} from '../../helpers/wait.ts';
import AppRecordsPage from '../../pageobjects/app-records.ts';

/** Waits for the named tab to be the one on screen. */
const waitForTab = async (tab: string) => {
  await waitForTestId(`app-notebook-tab-${tab}`, {timeout: 20000});
  await browser.waitUntil(
    async () =>
      (await byTestId(`app-notebook-tab-${tab}`).getAttribute(
        'aria-selected'
      )) === 'true',
    {timeout: 15000, timeoutMsg: `Expected the ${tab} tab on screen`}
  );
};

/** Opens the first record in the list on screen, and returns its id. */
const openFirstRecord = async (notebookUrl: string) => {
  const row = await $('.MuiDataGrid-row');
  await row.waitForClickable({timeout: 20000});
  await row.click();
  const recordUrl = await waitForUrl(`${notebookUrl}/view-record/`, {
    timeout: 20000,
    timeoutMsg: 'Expected the record route nested under the notebook',
  });
  return recordUrl.split('/view-record/')[1].replace(/[?#].*$/, '');
};

describe('App — notebook tab in context', () => {
  const noteText = `E2E tab context ${Date.now()}`;
  /** The notebook route, e.g. /surveys/<server>/<project> */
  let notebookUrl = '';

  before(async () => {
    await browser.reloadSession();
    await loginAppPersona('projectContributor');
    await AppRecordsPage.ensureNotebookOpen();
    notebookUrl = (await browser.getUrl()).split('?')[0].replace(/\/$/, '');
  });

  it('should keep the selected tab out of the URL', async () => {
    // Settings is not the notebook's default tab, so a tab written to the URL
    // would show up as a segment here
    await AppRecordsPage.openSettingsTab();
    await waitForTab('settings');
    await waitForUrl(url => url.replace(/[?#].*$/, '') === notebookUrl, {
      timeout: 10000,
      timeoutMsg: 'Expected selecting a tab to leave the notebook URL alone',
    });
    await captureStep({surface: 'app', label: 'tab-context-settings'});
  });

  it('should return to the list a record was opened from', async () => {
    await waitForTestId('app-notebook-tab-my-records', {timeout: 15000});
    await byTestId('app-notebook-tab-my-records').click();
    await waitForTab('my-records');

    await AppRecordsPage.createTextRecord(noteText);

    await byTestId('app-notebook-tab-my-records').click();
    await waitForTab('my-records');
    await openFirstRecord(notebookUrl);
    await captureStep({surface: 'app', label: 'tab-context-record'});

    const back = await $('[aria-label="Back"]');
    await back.waitForClickable({timeout: 15000});
    await back.click();
    await waitForUrl(url => url.replace(/\?.*$/, '') === notebookUrl, {
      timeout: 15000,
      timeoutMsg: 'Expected back from the record to land on the notebook',
    });
    await waitForTab('my-records');
    await captureStep({surface: 'app', label: 'tab-context-back-to-list'});
  });

  it('should return to the list after deleting the record', async () => {
    // A record of its own to delete, so the editor test after it still has one
    await AppRecordsPage.createTextRecord(`${noteText} spare`);
    await byTestId('app-notebook-tab-my-records').click();
    await waitForTab('my-records');

    await openFirstRecord(notebookUrl);
    // Delete sits on the record's own Info tab, not the one it opens on
    const info = await $('[aria-label="Record view tabs"]').$('button*=Info');
    await info.waitForClickable({timeout: 15000});
    await info.click();
    await waitForTestId('delete-btn', {timeout: 20000});
    await byTestId('delete-btn').click();
    // The confirm button stays disabled until the acknowledgement is ticked
    const acknowledge = await $('.MuiCheckbox-root');
    await acknowledge.waitForClickable({timeout: 15000});
    await acknowledge.click();
    await waitForTestId('confirm-delete', {timeout: 15000});
    await byTestId('confirm-delete').click();
    await waitForUrl(url => url.replace(/[?#].*$/, '') === notebookUrl, {
      timeout: 20000,
      timeoutMsg: 'Expected a delete to land back on the notebook',
    });
    await waitForTab('my-records');
    await captureStep({surface: 'app', label: 'tab-context-after-delete'});
  });

  it('should nest the editor under the notebook, naming no tab', async () => {
    const recordId = await openFirstRecord(notebookUrl);
    const edit = await $('button*=Edit record');
    await edit.waitForClickable({timeout: 20000});
    await edit.click();
    await waitForUrl(
      url =>
        url.replace(/[?#].*$/, '') === `${notebookUrl}/records/${recordId}`,
      {
        timeout: 20000,
        timeoutMsg: 'Expected the editor route nested under the notebook',
      }
    );
    await captureStep({surface: 'app', label: 'tab-context-edit'});
  });
});
