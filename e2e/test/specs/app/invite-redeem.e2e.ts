/**
 * Signed-in in-app redeem: paste a project invite code from the notebook
 * workspace and see the notebook appear without a Conductor round-trip.
 */
import {$} from '@wdio/globals';
import {loginAppPersona, loginWebPersona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {
  createNotebookFromTemplate,
  createNotebookInvite,
  findTeamIdByName,
  getWebAuthSession,
  refreshAccessToken,
} from '../../helpers/seed.ts';
import {byTestId} from '../../helpers/selectors.ts';
import AppNotebooksPage from '../../pageobjects/app-notebooks.ts';

describe('App — Redeem invite while signed in', () => {
  const surveyName = `E2E Redeem ${Date.now()}`;
  let inviteId = '';

  before(async () => {
    await browser.reloadSession();
    await loginWebPersona('redMemberCreator');
    let {token} = await getWebAuthSession();
    const teamId = await findTeamIdByName('Red', token);
    const notebookId = await createNotebookFromTemplate({
      name: surveyName,
      teamId,
      token,
    });
    token = await refreshAccessToken();
    const invite = await createNotebookInvite({
      notebookId,
      name: `Redeem ${surveyName}`,
      role: 'PROJECT_CONTRIBUTOR',
      uses: 1,
      token,
    });
    inviteId = invite.inviteId;

    await browser.reloadSession();
    await loginAppPersona('projectGuest');
  });

  it('should add the notebook after submitting an invite code', async () => {
    expect(inviteId.length).toBeGreaterThan(0);
    await AppNotebooksPage.open();
    await AppNotebooksPage.waitForWorkspace();
    await AppNotebooksPage.addButton.waitForClickable({timeout: 10000});
    await AppNotebooksPage.addButton.click();

    const entry = byTestId('invite-code-entry');
    await entry.waitForDisplayed({timeout: 10000});
    const input = entry.$('input');
    await input.setValue(inviteId);

    const submit = byTestId('invite-code-submit');
    await submit.waitForClickable({timeout: 10000});
    await submit.click();

    await browser.waitUntil(
      async () =>
        (await $('div*=You now have access').isExisting()) ||
        (await AppNotebooksPage.hasNotebookNamed(surveyName)),
      {
        timeout: 20000,
        timeoutMsg: 'Expected in-app redeem to grant the notebook',
      }
    );

    await AppNotebooksPage.openNotActiveTab();
    await AppNotebooksPage.waitForNotebookRow(surveyName);
    const url = await browser.getUrl();
    expect(url).not.toContain('/register');
    expect(url).not.toContain('/login');
    await captureStep({
      surface: 'app',
      label: 'invite-redeemed',
    });
  });
});
