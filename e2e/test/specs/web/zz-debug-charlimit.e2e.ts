/** TEMP debug spec — not committed. Diagnoses the edit-details char-limit test. */
import {loginWebPersona} from '../../helpers/auth.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';
import {getWebUrl} from '../../helpers/env.ts';

describe('DEBUG edit details char limit', () => {
  before(async () => {
    await browser.reloadSession();
    await loginWebPersona('managerBlue');
  });

  it('dumps dialog state', async () => {
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

    console.log('DEBUG url:', await browser.getUrl());

    const editBtn = byTestId('web-project-edit-details-button');
    console.log('DEBUG edit button exists:', await editBtn.isExisting());
    await editBtn.waitForClickable({timeout: 10000});
    await editBtn.click();

    await waitForTestId('web-project-edit-details-name', {timeout: 10000});
    const nameInput = byTestId('web-project-edit-details-name');
    console.log('DEBUG name value BEFORE:', await nameInput.getValue());

    await nameInput.setValue('abc');
    console.log('DEBUG name value AFTER setValue:', await nameInput.getValue());

    const submit = byTestId('web-project-edit-details-submit');
    console.log('DEBUG submit exists:', await submit.isExisting());
    console.log('DEBUG submit enabled:', await submit.isEnabled());
    await submit.click();

    await browser.pause(3000);

    const dialogEl = byTestId('web-project-edit-details-dialog');
    console.log('DEBUG dialog still exists:', await dialogEl.isExisting());
    if (await dialogEl.isExisting()) {
      console.log('DEBUG dialog TEXT >>>', await dialogEl.getText(), '<<<');
    }
    console.log('DEBUG name value AFTER submit:', await nameInput.getValue());
    console.log('DEBUG body text >>>', (await $('body').getText()).slice(0, 1500), '<<<');
  });
});
