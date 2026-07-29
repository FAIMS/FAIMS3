/**
 * Project Actions — editing a survey's name enforces the shared minimum length
 * (RESOURCE_NAME_MIN_LENGTH = 5).
 *
 * This covers the enforcement added to the edit-details form: previously the
 * create form bounded the name but editing did not. managerBlue is
 * PROJECT_MANAGER on the Blue project, which grants UPDATE_PROJECT_DETAILS.
 */
import {loginWebPersona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';
import {getWebUrl} from '../../helpers/env.ts';

/** Open the Blue project and switch to its Actions tab. */
async function openBlueProjectActions() {
  await browser.url(`${getWebUrl()}/projects`);
  await waitForTestId('web-projects-heading', {timeout: 15000});
  const search = byTestId('web-data-table-search');
  if (await search.isExisting()) {
    await search.setValue('Blue');
  }
  const row = await $('tbody tr');
  await row.waitForClickable({timeout: 15000});
  await row.click();
  await browser.waitUntil(
    async () => (await browser.getUrl()).match(/\/projects\/[^/]+/) !== null,
    {timeout: 10000}
  );
  const actionsTab = await $('button*=Actions');
  await actionsTab.waitForClickable({timeout: 10000});
  await actionsTab.click();
}

describe('Web — Project edit details name length', () => {
  before(async () => {
    await browser.reloadSession();
    await loginWebPersona('managerBlue');
  });

  it('rejects a survey name shorter than the minimum length', async () => {
    await openBlueProjectActions();

    // Open the "Edit name & description" dialog.
    await waitForTestId('web-project-edit-details-button', {timeout: 10000});
    await byTestId('web-project-edit-details-button').click();
    await waitForTestId('web-project-edit-details-name', {timeout: 10000});

    // Replace the current name with one below the 5-character minimum. The
    // field is pre-filled with the existing name, so it must be cleared first —
    // setValue alone appends and would leave a valid (long) name behind.
    const nameInput = byTestId('web-project-edit-details-name');
    await nameInput.clearValue();
    await nameInput.setValue('abc');
    await expect(nameInput).toHaveValue('abc');

    await byTestId('web-project-edit-details-submit').click();

    // The form blocks the update and shows the validation message inline; the
    // dialog stays open because no request is sent.
    const dialog = byTestId('web-project-edit-details-dialog');
    await browser.waitUntil(
      async () =>
        (await dialog.getText()).includes('must be at least 5 characters'),
      {
        timeout: 10000,
        timeoutMsg:
          'Expected a minimum-length validation error on the survey name field',
      }
    );
    await expect(dialog).toBeDisplayed();

    await captureStep({
      surface: 'web',
      label: 'edit-details-name-too-short',
    });
  });
});
