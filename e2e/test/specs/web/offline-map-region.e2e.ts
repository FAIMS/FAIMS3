/**
 * Offline map tab UI (draw control presence / guest read-only).
 * Full OpenLayers rectangle draw is out of scope for Classic WDIO v1.
 */
import {loginWebPersona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';
import {getWebUrl} from '../../helpers/env.ts';

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

describe('Web — Offline map region', () => {
  it('manager can open Offline Map and see Draw Area', async () => {
    await browser.reloadSession();
    await loginWebPersona('managerBlue');
    await openBlueProject();
    await waitForTestId('web-project-tab-offline-map');
    await byTestId('web-project-tab-offline-map').click();
    await waitForTestId('web-offline-map-status');
    await waitForTestId('web-offline-map-draw-button');
    const draw = byTestId('web-offline-map-draw-button');
    expect(await draw.isEnabled()).toBe(true);
    await captureStep({
      surface: 'web',
      label: 'offline-map-draw',
    });
  });

  it('projectGuest sees Offline Map without enabled Draw', async () => {
    await browser.reloadSession();
    await loginWebPersona('projectGuest');
    await openBlueProject();
    await waitForTestId('web-project-tab-offline-map');
    await byTestId('web-project-tab-offline-map').click();
    await waitForTestId('web-offline-map-status');
    const draw = byTestId('web-offline-map-draw-button');
    if (await draw.isExisting()) {
      expect(await draw.isEnabled()).toBe(false);
    }
    const status = await byTestId('web-offline-map-status').getText();
    expect(status.length).toBeGreaterThan(0);
    await captureStep({
      surface: 'web',
      label: 'guest-offline-map',
    });
  });
});
