/**
 * Export tab: dialogs, time-range controls, and intercepted export URLs.
 * File download is still deferred (fetch is stubbed; window.open is no-op).
 */
import {loginWebPersona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';
import {getWebUrl} from '../../helpers/env.ts';

const FROM_LOCAL = '2024-06-01T12:00';
const TO_LOCAL = '2024-06-01T13:00';
const FROM_AFTER_TO = '2024-06-01T14:00';

async function openBlueProject() {
  await browser.url(`${getWebUrl()}/projects`);
  await waitForTestId('web-main', {timeout: 15000});
  const search = byTestId('web-data-table-search');
  if (await search.isExisting()) {
    await search.setValue('Blue');
  }
  const row = await $('tbody tr');
  await row.waitForClickable({timeout: 10000});
  await row.click();
  await browser.waitUntil(
    async () => (await browser.getUrl()).includes('/projects/'),
    {timeout: 10000}
  );
}

async function openExportTab() {
  await openBlueProject();
  await waitForTestId('web-project-tab-export');
  await byTestId('web-project-tab-export').click();
  await waitForTestId('web-export-data-button');
}

async function installExportIntercept() {
  await browser.execute(() => {
    const w = window as Window & {__exportCalls?: string[]};
    w.__exportCalls = [];
    const origFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url.includes('/records/export')) {
        w.__exportCalls!.push(url);
        return new Response(
          JSON.stringify({url: 'http://localhost/stub-download'}),
          {
            status: 200,
            headers: {'Content-Type': 'application/json'},
          }
        );
      }
      return origFetch(input, init);
    };
    window.open = () => null;
  });
}

async function lastExportUrl(): Promise<string> {
  const calls = await browser.execute(() => {
    const w = window as Window & {__exportCalls?: string[]};
    return w.__exportCalls ?? [];
  });
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1];
}

async function expectedAfterMs(fromLocal: string): Promise<number> {
  return browser.execute(
    (value: string) => new Date(value).getTime() - 1,
    fromLocal
  );
}

async function expectedBeforeMs(toLocal: string): Promise<number> {
  return browser.execute(
    (value: string) => new Date(value).getTime() + 60_000,
    toLocal
  );
}

async function enableTimeRange() {
  const checkbox = byTestId('web-export-time-range-enabled');
  await checkbox.waitForClickable({timeout: 10000});
  await expect(byTestId('web-export-time-from')).not.toBeDisplayed();
  await checkbox.click();
  await waitForTestId('web-export-time-from');
  await expect(byTestId('web-export-time-to')).toBeDisplayed();
  await expect(checkbox).toHaveAttribute('aria-checked', 'true');
}

describe('Web — Project exports', () => {
  before(async () => {
    await browser.reloadSession();
    await loginWebPersona('managerBlue');
  });

  it('should open Export tab and Data Export dialog', async () => {
    await openExportTab();
    await expect(byTestId('web-export-full-button')).toBeDisplayed();
    await byTestId('web-export-data-button').click();
    await waitForTestId('web-export-data-dialog');
    await captureStep({
      surface: 'web',
      label: 'export-dialog',
    });
  });

  it('should reveal From/To when the time-range checkbox is enabled', async () => {
    await openExportTab();
    await byTestId('web-export-full-button').click();
    await waitForTestId('web-export-full-dialog');
    await enableTimeRange();
  });

  it('should reveal From/To on Data and Photo export after ticking the checkbox', async () => {
    await openExportTab();
    await byTestId('web-export-data-button').click();
    await waitForTestId('web-export-data-dialog');
    await byTestId('web-export-data-tabular').click();
    await waitForTestId('web-export-data-download');
    await enableTimeRange();

    await browser.keys('Escape');
    await byTestId('web-export-photos-button').click();
    await byTestId('web-export-photos-all').click();
    await waitForTestId('web-export-photos-download');
    await enableTimeRange();
  });

  it('should disable Full download when From is after To', async () => {
    await openExportTab();
    await byTestId('web-export-full-button').click();
    await waitForTestId('web-export-full-dialog');
    await enableTimeRange();
    await byTestId('web-export-time-from').setValue(FROM_AFTER_TO);
    await byTestId('web-export-time-to').setValue(FROM_LOCAL);
    const download = byTestId('web-export-full-download');
    await expect(download).toBeDisabled();
    await expect($('p*=From must be earlier than To.')).toBeDisplayed();
  });

  it('should omit time params from Full export when unchecked', async () => {
    await openExportTab();
    await byTestId('web-export-full-button').click();
    await waitForTestId('web-export-full-dialog');
    await installExportIntercept();
    await byTestId('web-export-full-download').click();
    const url = await lastExportUrl();
    expect(url).toContain('format=full');
    expect(url).not.toContain('updatedAfter=');
    expect(url).not.toContain('updatedBefore=');
  });

  it('should send From-only bounds on Full export', async () => {
    await openExportTab();
    await byTestId('web-export-full-button').click();
    await waitForTestId('web-export-full-dialog');
    await enableTimeRange();
    await byTestId('web-export-time-from').setValue(FROM_LOCAL);
    await installExportIntercept();
    const expectedAfter = await expectedAfterMs(FROM_LOCAL);
    await byTestId('web-export-full-download').click();
    const url = await lastExportUrl();
    expect(url).toContain(`updatedAfter=${expectedAfter}`);
    expect(url).not.toContain('updatedBefore=');
  });

  it('should send both bounds on Full export', async () => {
    await openExportTab();
    await byTestId('web-export-full-button').click();
    await waitForTestId('web-export-full-dialog');
    await enableTimeRange();
    await byTestId('web-export-time-from').setValue(FROM_LOCAL);
    await byTestId('web-export-time-to').setValue(TO_LOCAL);
    await installExportIntercept();
    const expectedAfter = await expectedAfterMs(FROM_LOCAL);
    const expectedBefore = await expectedBeforeMs(TO_LOCAL);
    await byTestId('web-export-full-download').click();
    const url = await lastExportUrl();
    expect(url).toContain(`updatedAfter=${expectedAfter}`);
    expect(url).toContain(`updatedBefore=${expectedBefore}`);
  });

  it('should send both bounds and viewID on Data CSV export', async () => {
    await openExportTab();
    await byTestId('web-export-data-button').click();
    await waitForTestId('web-export-data-dialog');
    await byTestId('web-export-data-tabular').click();
    await waitForTestId('web-export-data-download');
    const trigger = await $('button[role="combobox"]');
    await trigger.waitForClickable({timeout: 10000});
    await trigger.click();
    const option = await $('[role="option"]');
    await option.waitForClickable({timeout: 10000});
    await option.click();
    await enableTimeRange();
    await byTestId('web-export-time-from').setValue(FROM_LOCAL);
    await byTestId('web-export-time-to').setValue(TO_LOCAL);
    await installExportIntercept();
    const expectedAfter = await expectedAfterMs(FROM_LOCAL);
    const expectedBefore = await expectedBeforeMs(TO_LOCAL);
    await byTestId('web-export-data-download').click();
    const url = await lastExportUrl();
    expect(url).toContain('format=csv');
    expect(url).toMatch(/viewID=/);
    expect(url).toContain(`updatedAfter=${expectedAfter}`);
    expect(url).toContain(`updatedBefore=${expectedBefore}`);
  });

  it('should send To-only bounds on Photo all-forms zip export', async () => {
    await openExportTab();
    await byTestId('web-export-photos-button').click();
    await byTestId('web-export-photos-all').click();
    await waitForTestId('web-export-photos-download');
    await enableTimeRange();
    await byTestId('web-export-time-to').setValue(TO_LOCAL);
    await installExportIntercept();
    const expectedBefore = await expectedBeforeMs(TO_LOCAL);
    await byTestId('web-export-photos-download').click();
    const url = await lastExportUrl();
    expect(url).toContain('format=zip');
    expect(url).not.toContain('updatedAfter=');
    expect(url).toContain(`updatedBefore=${expectedBefore}`);
  });
});
