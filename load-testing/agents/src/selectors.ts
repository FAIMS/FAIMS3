import type {Locator, Page} from 'playwright';

/**
 * Playwright locators with fallbacks for deployments that predate load-test
 * data-testid hooks (main branch). Prefer test ids when present; remove
 * fallbacks once dev runs the instrumented app build.
 */

/** Activate control in the workspace notebook list (optionally scoped to a row). */
export function notebookActivateButton(page: Page, row?: Locator): Locator {
  const scope = row ?? page;
  const button = scope
    .getByTestId('notebook-activate-button')
    .or(scope.getByRole('button', {name: /^Activate$/i}));
  return row ? button : button.first();
}

/** Confirm button in the notebook activation dialog. */
export function notebookActivateConfirm(page: Page): Locator {
  return page
    .getByTestId('notebook-activate-confirm')
    .or(page.getByRole('dialog').getByRole('button', {name: /^Activate$/i}));
}

/** Primary control to start creating a new record in the notebook list. */
export function addRecordButton(page: Page, formType?: string): Locator {
  if (formType) {
    const label = escapeRegExp(formType);
    return page
      .getByRole('button', {
        name: new RegExp(`^(?:Add new |New )?${label}$`, 'i'),
      })
      .first();
  }

  return page
    .getByTestId('add-record-button')
    .or(page.getByRole('button', {name: /add new/i}).first());
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Debounced-save confirmation in the record editor. */
export function saveRecordIndicator(page: Page): Locator {
  return page
    .getByTestId('save-record-indicator')
    .or(page.getByText('Saved', {exact: true}));
}

/** Finish / submit control on the record form (label varies by form type). */
export function finishRecordButton(page: Page): Locator {
  return page
    .locator('[data-testid^="nav-button-finish"]')
    .or(page.getByRole('button', {name: /^Finish /i}))
    .first();
}

/** Confirm on the "finish with incomplete fields" guard dialog. */
export function finishAnywayButton(page: Page): Locator {
  return page
    .getByTestId('finish-anyway-button')
    .or(page.getByRole('button', {name: /^Finish anyway$/i}));
}

/** Cloud sync status control in the main app bar (#app-bar). */
export function syncStatusIcon(page: Page): Locator {
  // Legacy main: SyncStatus is the first button in the toolbar's trailing cluster.
  // Do not use [aria-describedby] — that attribute is only present while the
  // popover is open.
  const legacy = page
    .locator('#app-bar .MuiToolbar-root > div')
    .last()
    .locator('button[type="button"]')
    .first();
  return page.getByTestId('sync-status-icon').or(legacy);
}

async function usesSyncTestIds(page: Page): Promise<boolean> {
  return (await page.getByTestId('sync-status-icon').count()) > 0;
}

/**
 * After reconnect, wait for sync to finish. Supports both test-id markers and
 * legacy UI (sync status popover table).
 */
export async function waitForSyncComplete(
  page: Page,
  timeoutMs: number
): Promise<{sawSyncing: boolean}> {
  const syncIcon = syncStatusIcon(page);
  const syncVisible = await syncIcon
    .waitFor({state: 'visible', timeout: 30000})
    .then(() => true)
    .catch(() => false);

  if (!syncVisible) {
    // App bar missing (wrong route) — allow a bounded wait and continue.
    await page.waitForTimeout(Math.min(timeoutMs, 15000));
    return {sawSyncing: false};
  }

  await page.waitForTimeout(1000);

  if (await usesSyncTestIds(page)) {
    const syncing = page.getByTestId('sync-status-syncing');
    const sawSyncing = await syncing
      .waitFor({state: 'attached', timeout: 20000})
      .then(() => true)
      .catch(() => false);

    if (sawSyncing) {
      await page.getByTestId('sync-status-idle').waitFor({timeout: timeoutMs});
    }
    return {sawSyncing};
  }

  return waitForSyncCompleteLegacy(page, syncIcon, timeoutMs);
}

async function waitForSyncCompleteLegacy(
  page: Page,
  syncIcon: Locator,
  timeoutMs: number
): Promise<{sawSyncing: boolean}> {
  await syncIcon.click();
  const statusTable = page.getByRole('table', {name: 'sync status details'});

  const deadline = Date.now() + timeoutMs;
  let sawSyncing = false;

  while (Date.now() < deadline) {
    const statusText =
      (await statusTable
        .getByRole('cell')
        .filter({hasText: /In Progress|Complete|Error/})
        .last()
        .textContent()
        .catch(() => null)) ?? '';

    if (statusText.includes('In Progress')) {
      sawSyncing = true;
    }
    if (sawSyncing && statusText.includes('Complete')) {
      await page.keyboard.press('Escape').catch(() => undefined);
      return {sawSyncing: true};
    }
    if (!sawSyncing && statusText.includes('Complete')) {
      await page.keyboard.press('Escape').catch(() => undefined);
      return {sawSyncing: false};
    }
    await page.waitForTimeout(500);
  }

  await page.keyboard.press('Escape').catch(() => undefined);
  return {sawSyncing};
}
