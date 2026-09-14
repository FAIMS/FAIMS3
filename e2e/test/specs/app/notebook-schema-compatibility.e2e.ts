/**
 * Notebook schema compatibility — app fail-soft path (schemaTester persona).
 *
 * The seed writes copies of the Red design for this persona (see
 * `api/src/scripts/seedTestDataset.ts`):
 *
 * - "Future Schema (newer major …)" → tier `incompatible`: listed with a chip,
 *   activation disabled, row still opens the skeleton + copyable report.
 * - "Future Schema (newer minor …)" → tier `degraded`: listed with a chip,
 *   renders with a warning banner, record creation still available.
 * - "Last Good Schema (current)" → starts readable; this spec stamps Couch to
 *   a newer major after activate + create, then asserts the last-good graph
 *   (and the local record) survive list refresh and reload.
 *
 * Covers the list chip → skeleton → copy report flow, the last-good path, and
 * that the persisted tier survives a reload.
 */
import {loginAppPersona} from '../../helpers/auth.ts';
import {
  nextMajorSchemaVersion,
  readNotebookSchemaVersion,
  SEED_LAST_GOOD_NOTEBOOK_ID,
  SEED_LAST_GOOD_NOTEBOOK_NAME,
  stampNotebookSchemaVersion,
} from '../../helpers/couch.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';
import AppNotebooksPage from '../../pageobjects/app-notebooks.ts';
import AppRecordsPage from '../../pageobjects/app-records.ts';

const NEWER_MAJOR = 'Future Schema (newer major';
const NEWER_MINOR = 'Future Schema (newer minor';

/** `X.Y.Z` in "Future Schema (newer major X.Y.Z) — …" */
function versionFromRowText(text: string): string | undefined {
  return /newer (?:major|minor) (\d+\.\d+\.\d+)\)/.exec(text)?.[1];
}

describe('App — Notebook schema compatibility (fail-soft)', () => {
  let newerMajorVersion: string | undefined;

  before(async () => {
    await browser.reloadSession();
    await loginAppPersona('schemaTester');
    await AppNotebooksPage.open();
    await AppNotebooksPage.waitForWorkspace();
  });

  it('lists future-schema notebooks with compatibility chips', async () => {
    await AppNotebooksPage.openNotActiveTab();

    const majorRow = await AppNotebooksPage.waitForNotebookRow(NEWER_MAJOR);
    newerMajorVersion = versionFromRowText(await majorRow.getText());
    expect(newerMajorVersion).toBeTruthy();
    await expect(
      majorRow.$('[data-testid="notebook-schema-chip-incompatible"]')
    ).toBeDisplayed();

    const minorRow = await AppNotebooksPage.waitForNotebookRow(NEWER_MINOR);
    await expect(
      minorRow.$('[data-testid="notebook-schema-chip-degraded"]')
    ).toBeDisplayed();

    await captureStep({surface: 'app', label: 'schema-compat-list-chips'});
  });

  it('opens the newer-major notebook to the skeleton with a copyable report', async () => {
    // First activation of a never-readable design is blocked; the row still
    // opens so the diagnostic is reachable without downloading records.
    await AppNotebooksPage.openNotActiveNotebookNamed(NEWER_MAJOR);

    await waitForTestId('notebook-schema-incompatible-view', {timeout: 20000});
    await expect(byTestId('notebook-schema-chip-incompatible')).toBeDisplayed();

    const report = await byTestId('notebook-compatibility-report').getText();
    expect(report).toContain('Tier: incompatible');
    expect(report).toContain(`schemaVersion: ${newerMajorVersion}`);
    expect(report).toMatch(/App schemaVersion: \d+\.\d+\.\d+/);
    expect(report).toContain('App version:');

    // The seeded copy was never readable by this build, so there is no last
    // good design: no record list and no way to add records.
    expect(await AppRecordsPage.addButton.isExisting()).toBe(false);

    await captureStep({surface: 'app', label: 'schema-compat-skeleton'});
  });

  it('copies the diagnostic report to the clipboard', async () => {
    // Headless Chrome has no clipboard permission; capture what the app writes.
    await browser.execute(() => {
      const w = window as unknown as {__copiedReport?: string};
      w.__copiedReport = undefined;
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            w.__copiedReport = text;
          },
        },
      });
    });

    const copy = byTestId('notebook-compatibility-copy-report');
    await copy.waitForClickable({timeout: 10000});
    await copy.click();

    // MUI upper-cases button labels via CSS; compare case-insensitively.
    await browser.waitUntil(async () => /copied/i.test(await copy.getText()), {
      timeout: 5000,
      timeoutMsg: 'Expected copy button to confirm "Copied"',
    });
    const copied = await browser.execute(
      () => (window as unknown as {__copiedReport?: string}).__copiedReport
    );
    expect(copied).toContain('Tier: incompatible');
    expect(copied).toContain(`schemaVersion: ${newerMajorVersion}`);

    await captureStep({surface: 'app', label: 'schema-compat-report-copied'});
  });

  it('keeps the incompatible state after a reload (persisted tier)', async () => {
    await browser.refresh();
    await waitForTestId('notebook-schema-incompatible-view', {timeout: 30000});
    expect(await AppRecordsPage.addButton.isExisting()).toBe(false);
  });

  it('renders the newer-minor notebook with a warning and allows records', async () => {
    await AppNotebooksPage.open();
    await AppNotebooksPage.waitForWorkspace();
    await AppNotebooksPage.activateNotebookNamed(NEWER_MINOR);
    await AppNotebooksPage.openActiveNotebookNamed(NEWER_MINOR);

    await waitForTestId('notebook-schema-degraded-alert', {timeout: 20000});
    expect(
      await byTestId('notebook-schema-incompatible-view').isExisting()
    ).toBe(false);
    await expect(AppRecordsPage.addButton).toBeDisplayed();

    await captureStep({surface: 'app', label: 'schema-compat-degraded'});
  });
});

describe('App — Notebook schema compatibility (last-good after upgrade)', () => {
  const noteText = `Last-good e2e ${Date.now()}`;
  let originalSchemaVersion = '';

  before(async () => {
    await browser.reloadSession();
    await loginAppPersona('schemaTester');
    await AppNotebooksPage.open();
    await AppNotebooksPage.waitForWorkspace();
    await AppNotebooksPage.activateNotebookNamed(SEED_LAST_GOOD_NOTEBOOK_NAME);
    await AppNotebooksPage.openActiveNotebookNamed(
      SEED_LAST_GOOD_NOTEBOOK_NAME
    );
    await AppRecordsPage.createTextRecord(noteText);
  });

  after(async () => {
    if (!originalSchemaVersion) return;
    await stampNotebookSchemaVersion(
      SEED_LAST_GOOD_NOTEBOOK_ID,
      originalSchemaVersion
    );
  });

  it('keeps records and blocks create after the server design becomes a newer major', async () => {
    originalSchemaVersion = await readNotebookSchemaVersion(
      SEED_LAST_GOOD_NOTEBOOK_ID
    );
    await stampNotebookSchemaVersion(
      SEED_LAST_GOOD_NOTEBOOK_ID,
      nextMajorSchemaVersion(originalSchemaVersion)
    );

    await AppNotebooksPage.open();
    await AppNotebooksPage.waitForWorkspace();
    await AppNotebooksPage.refreshNotebookList();

    await AppNotebooksPage.openActiveTab();
    const row = await AppNotebooksPage.waitForNotebookRow(
      SEED_LAST_GOOD_NOTEBOOK_NAME
    );
    await expect(
      row.$('[data-testid="notebook-schema-chip-incompatible"]')
    ).toBeDisplayed();

    await AppNotebooksPage.openActiveNotebookNamed(
      SEED_LAST_GOOD_NOTEBOOK_NAME
    );
    await waitForTestId('notebook-schema-incompatible-view', {timeout: 20000});
    expect(await AppRecordsPage.addButton.isExisting()).toBe(false);
    await browser.waitUntil(
      async () => {
        const body = await $('body').getText();
        return body.includes(noteText) || body.includes(noteText.slice(0, 12));
      },
      {
        timeout: 20000,
        timeoutMsg: `Expected last-good record "${noteText}" still listed`,
      }
    );

    await captureStep({surface: 'app', label: 'schema-compat-last-good'});
  });

  it('keeps the last-good graph after a second list refresh', async () => {
    await AppNotebooksPage.open();
    await AppNotebooksPage.waitForWorkspace();
    await AppNotebooksPage.refreshNotebookList();
    await AppNotebooksPage.openActiveNotebookNamed(
      SEED_LAST_GOOD_NOTEBOOK_NAME
    );

    await waitForTestId('notebook-schema-incompatible-view', {timeout: 20000});
    expect(await AppRecordsPage.addButton.isExisting()).toBe(false);
    await browser.waitUntil(
      async () => (await $('body').getText()).includes(noteText.slice(0, 12)),
      {
        timeout: 20000,
        timeoutMsg: `Expected last-good record still listed after second refresh`,
      }
    );
  });

  it('keeps the last-good graph after a reload', async () => {
    await browser.refresh();
    await waitForTestId('notebook-schema-incompatible-view', {timeout: 30000});
    expect(await AppRecordsPage.addButton.isExisting()).toBe(false);
    await browser.waitUntil(
      async () => (await $('body').getText()).includes(noteText.slice(0, 12)),
      {
        timeout: 20000,
        timeoutMsg: `Expected last-good record still listed after reload`,
      }
    );
  });
});
