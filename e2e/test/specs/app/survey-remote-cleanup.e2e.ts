/**
 * App survey cleanup after remote lifecycle changes:
 * - tombstoned (permanently deleted) → remove local survey
 * - missing without tombstone (access revoked) → keep local survey
 */
import {
  loginAppPersona,
  loginWebPersona,
  logoutWeb,
  persona,
} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {
  createNotebookFromTemplate,
  deleteNotebookPermanently,
  findTeamIdByName,
  getWebAuthSession,
  refreshAccessToken,
  setNotebookStatus,
  setNotebookUserRole,
} from '../../helpers/seed.ts';
import AppNotebooksPage from '../../pageobjects/app-notebooks.ts';

async function provisionDisposableSurvey(name: string): Promise<{
  notebookId: string;
  creatorToken: string;
}> {
  await loginWebPersona('redMemberCreator');
  let {token} = await getWebAuthSession();
  const teamId = await findTeamIdByName('Red', token);
  const notebookId = await createNotebookFromTemplate({
    name,
    teamId,
    token,
  });
  // PROJECT_ADMIN is granted on create — refresh before role / lifecycle APIs
  token = await refreshAccessToken();
  await setNotebookUserRole({
    notebookId,
    username: persona('projectContributor').email,
    role: 'PROJECT_CONTRIBUTOR',
    addRole: true,
    token,
  });
  await logoutWeb();
  return {notebookId, creatorToken: token};
}

describe('App — Survey remote cleanup (tombstone)', () => {
  const surveyName = `E2E TombClean ${Date.now()}`;
  let notebookId = '';
  let creatorToken = '';

  before(async () => {
    await browser.reloadSession();
    ({notebookId, creatorToken} = await provisionDisposableSurvey(surveyName));
    await browser.reloadSession();
    await loginAppPersona('projectContributor');
    await AppNotebooksPage.open();
    await AppNotebooksPage.waitForWorkspace();
    await AppNotebooksPage.activateNotebookNamed(surveyName);
    await AppNotebooksPage.waitForActiveNotebookNamed(surveyName);
  });

  it('should remove a locally activated survey after tombstone delete + refresh', async () => {
    await setNotebookStatus({
      notebookId,
      status: 'CLOSED',
      token: creatorToken,
    });
    await setNotebookStatus({
      notebookId,
      status: 'ARCHIVED',
      token: creatorToken,
    });
    await deleteNotebookPermanently({
      notebookId,
      confirmName: surveyName,
      token: creatorToken,
    });

    await AppNotebooksPage.open();
    await AppNotebooksPage.waitForWorkspace();
    await AppNotebooksPage.refreshNotebookList();
    await AppNotebooksPage.waitForNotebookGone(surveyName);

    await captureStep({
      surface: 'app',
      label: 'tombstone-cleanup-removed',
    });
  });
});

describe('App — Survey remote cleanup (no tombstone)', () => {
  const surveyName = `E2E KeepLocal ${Date.now()}`;
  let notebookId = '';
  let creatorToken = '';

  before(async () => {
    await browser.reloadSession();
    ({notebookId, creatorToken} = await provisionDisposableSurvey(surveyName));
    await browser.reloadSession();
    await loginAppPersona('projectContributor');
    await AppNotebooksPage.open();
    await AppNotebooksPage.waitForWorkspace();
    await AppNotebooksPage.activateNotebookNamed(surveyName);
    await AppNotebooksPage.waitForActiveNotebookNamed(surveyName);
  });

  it('should keep local survey when missing from directory without a tombstone', async () => {
    // Revoke access: survey disappears from directory / notebook GET, but no
    // tombstone exists — cleanup must not wipe local data.
    await setNotebookUserRole({
      notebookId,
      username: persona('projectContributor').email,
      role: 'PROJECT_CONTRIBUTOR',
      addRole: false,
      token: creatorToken,
    });

    await AppNotebooksPage.open();
    await AppNotebooksPage.waitForWorkspace();
    await AppNotebooksPage.refreshNotebookList();

    await AppNotebooksPage.openActiveTab();
    await browser.waitUntil(
      async () => await AppNotebooksPage.hasNotebookNamed(surveyName),
      {
        timeout: 15000,
        timeoutMsg: `Expected local survey "${surveyName}" to remain after refresh without tombstone`,
      }
    );

    await captureStep({
      surface: 'app',
      label: 'missing-no-tombstone-kept',
    });
  });
});
