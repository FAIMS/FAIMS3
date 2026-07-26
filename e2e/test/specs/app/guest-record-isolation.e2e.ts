/**
 * Auth-proxy sync isolation on Red e2e-minimal notebook.
 *
 * Guest A creates a record; Guest B must not receive it locally or via the
 * public proxy URL; Contributor / Manager / Admin / team-member (virtual
 * contributor) must pull it.
 *
 * Requires couch-auth-proxy on COUCHDB_PUBLIC_URL and the extended seed
 * (projectGuest + projectGuestB on notebook_seed_red).
 */
import {loginAppPersona, logoutApp} from '../../helpers/auth.ts';
import {SEED_NOTEBOOK, type PersonaKey} from '../../helpers/env.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {
  assertDocStaysAbsent,
  findLocalRecordIdsByNotes,
  getActiveProjectId,
  localHasDoc,
  remoteHasDoc,
  waitForLocalRecordByNotes,
  waitForRemoteDoc,
} from '../../helpers/syncProbe.ts';
import AppRecordsPage from '../../pageobjects/app-records.ts';

const RED = SEED_NOTEBOOK.red;

async function asPersonaOpenRed(persona: PersonaKey): Promise<void> {
  await browser.reloadSession();
  await loginAppPersona(persona);
  await AppRecordsPage.ensureNotebookOpen(RED);
}

async function expectNotesVisible(notes: string): Promise<void> {
  const search = byTestId('record-search-input');
  if (await search.isExisting()) {
    const input = await search.$('input');
    if (await input.isExisting()) {
      await input.waitForDisplayed({timeout: 5000});
      await input.setValue(notes);
    }
  }
  await browser.waitUntil(
    async () => {
      const body = await $('body').getText();
      return body.includes(notes) || body.includes(notes.slice(0, 12));
    },
    {
      timeout: 45000,
      timeoutMsg: `Expected UI to show record notes "${notes}"`,
    }
  );
}

async function expectNotesAbsent(notes: string): Promise<void> {
  const search = byTestId('record-search-input');
  if (await search.isExisting()) {
    const input = await search.$('input');
    if (await input.isExisting()) {
      await input.waitForDisplayed({timeout: 5000});
      await input.setValue(notes);
    }
  }
  await browser.pause(1500);
  const body = await $('body').getText();
  expect(body.includes(notes)).toBe(false);
}

async function openOtherRecordsTab(): Promise<void> {
  const otherTab = byTestId('app-notebook-tab-other-records');
  await otherTab.waitForExist({timeout: 20000});
  await otherTab.waitForClickable({timeout: 10000});
  await otherTab.click();
  await browser.waitUntil(
    async () => (await browser.getUrl()).includes('tab=other_records'),
    {
      timeout: 10000,
      timeoutMsg: 'Expected notebook tab=other_records after clicking Other',
    }
  );
}

async function waitForCorpusDoc(projectId: string, recordId: string) {
  await browser.waitUntil(
    async () =>
      (await localHasDoc(projectId, recordId)) &&
      (await remoteHasDoc(projectId, recordId)) === true,
    {
      timeout: 45000,
      timeoutMsg: `Did not receive ${recordId} via proxy sync for ${projectId}`,
      interval: 500,
    }
  );
}

describe('App — Auth-proxy guest record isolation', () => {
  const guestANotes = `guest-A-secret-${Date.now()}`;
  let recordId = '';
  let projectId: string = RED;

  it('guest A creates a record and pushes through the proxy', async () => {
    await asPersonaOpenRed('projectGuest');
    projectId = await getActiveProjectId();
    expect(projectId).toBe(RED);

    await AppRecordsPage.createTextRecord(guestANotes);
    recordId = await waitForLocalRecordByNotes(projectId, guestANotes);
    await waitForRemoteDoc(projectId, recordId);

    await expectNotesVisible(guestANotes);
    await captureStep({
      surface: 'app',
      label: 'guest-a-record-synced',
    });
    await logoutApp();
  });

  it('guest B does not sync guest A record (UI + local + proxy)', async () => {
    expect(recordId).toBeTruthy();
    await asPersonaOpenRed('projectGuestB');
    projectId = await getActiveProjectId();

    await assertDocStaysAbsent(projectId, recordId, 10000);
    await expectNotesAbsent(guestANotes);

    await captureStep({
      surface: 'app',
      label: 'guest-b-isolated',
    });
    await logoutApp();
  });

  it('contributor syncs guest A record and can open it in the UI', async () => {
    expect(recordId).toBeTruthy();
    await asPersonaOpenRed('projectContributor');
    projectId = await getActiveProjectId();

    await waitForCorpusDoc(projectId, recordId);
    await openOtherRecordsTab();
    await expectNotesVisible(guestANotes);
    await captureStep({
      surface: 'app',
      label: 'contributor-sees-guest-a',
    });
    await logoutApp();
  });

  it('manager (team virtual) syncs the same guest A record', async () => {
    expect(recordId).toBeTruthy();
    await asPersonaOpenRed('managerRed');
    projectId = await getActiveProjectId();

    await waitForCorpusDoc(projectId, recordId);
    await openOtherRecordsTab();
    await expectNotesVisible(guestANotes);
    await captureStep({
      surface: 'app',
      label: 'manager-sees-guest-a',
    });
    await logoutApp();
  });

  it('admin (team virtual) syncs the same guest A record', async () => {
    expect(recordId).toBeTruthy();
    await asPersonaOpenRed('adminRed');
    projectId = await getActiveProjectId();

    await waitForCorpusDoc(projectId, recordId);
    await openOtherRecordsTab();
    await expectNotesVisible(guestANotes);
    await captureStep({
      surface: 'app',
      label: 'admin-sees-guest-a',
    });
    await logoutApp();
  });

  it('team member (virtual contributor) syncs guest A record', async () => {
    expect(recordId).toBeTruthy();
    await asPersonaOpenRed('memberBoth');
    projectId = await getActiveProjectId();

    await waitForCorpusDoc(projectId, recordId);
    await openOtherRecordsTab();
    await expectNotesVisible(guestANotes);
    await captureStep({
      surface: 'app',
      label: 'team-member-sees-guest-a',
    });
    await logoutApp();
  });

  it('contributor edit is pulled by guest A (parent inheritance) but not guest B', async () => {
    expect(recordId).toBeTruthy();
    const editedNotes = `${guestANotes}-edited-by-contributor`;

    await asPersonaOpenRed('projectContributor');
    projectId = await getActiveProjectId();
    await waitForCorpusDoc(projectId, recordId);
    await openOtherRecordsTab();
    await AppRecordsPage.openRecordContaining(guestANotes);
    await AppRecordsPage.updateOpenRecordNotes(editedNotes);
    // Contributor's new frevs/avps must be on the proxy before guest A pulls.
    await waitForLocalRecordByNotes(projectId, editedNotes);
    await captureStep({
      surface: 'app',
      label: 'contributor-edited-guest-a',
    });
    await logoutApp();

    await asPersonaOpenRed('projectGuest');
    projectId = await getActiveProjectId();
    await browser.waitUntil(
      async () =>
        (await findLocalRecordIdsByNotes(projectId, editedNotes)).length > 0,
      {
        timeout: 45000,
        timeoutMsg: `Guest A did not pull contributor edit "${editedNotes}"`,
        interval: 1000,
      }
    );
    // Guest A's own tab should list the updated HRID/notes.
    await expectNotesVisible(editedNotes);
    await captureStep({
      surface: 'app',
      label: 'guest-a-pulled-contributor-edit',
    });
    await logoutApp();

    await asPersonaOpenRed('projectGuestB');
    projectId = await getActiveProjectId();
    await assertDocStaysAbsent(projectId, recordId, 8000);
    await expectNotesAbsent(editedNotes);
    await captureStep({
      surface: 'app',
      label: 'guest-b-still-isolated-after-edit',
    });
  });
});
