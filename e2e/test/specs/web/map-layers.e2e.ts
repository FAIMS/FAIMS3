/**
 * Control Centre map-layer UI without uploading a file (GDAL / spatial-worker
 * are not part of the e2e stack). Seed has no ready map assets, so linking
 * and unlinking are out of scope; role-gated create is covered instead.
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

describe('Web — Map layers', () => {
  it('shows add-layer for a team member creator', async () => {
    await browser.reloadSession();
    await loginWebPersona('redMemberCreator');
    await browser.url(`${getWebUrl()}/map-layers`);
    await waitForTestId('web-map-layers-create-button');
    await byTestId('web-map-layers-create-button').click();
    await waitForTestId('web-map-layers-create-dialog');
    await waitForTestId('web-map-layers-create-name');
    await waitForTestId('web-map-layers-create-files');
    await captureStep({
      surface: 'web',
      label: 'map-layers-create-dialog',
    });
  });

  it('shows add-layer for a team manager (CREATE_MAP_ASSET_IN_TEAM)', async () => {
    await browser.reloadSession();
    await loginWebPersona('managerBlue');
    await browser.url(`${getWebUrl()}/map-layers`);
    await waitForTestId('web-map-layers-create-button');
    await captureStep({
      surface: 'web',
      label: 'map-layers-manager-create',
    });
  });

  it('hides add-layer for a team member without upload permission', async () => {
    await browser.reloadSession();
    await loginWebPersona('memberBoth');
    await browser.url(`${getWebUrl()}/map-layers`);
    await waitForTestId('web-map-layers-heading');
    await expect(byTestId('web-map-layers-create-button')).not.toBeExisting();
    await captureStep({
      surface: 'web',
      label: 'map-layers-member-no-create',
    });
  });

  it('opens the survey Map layers tab with no linked layers', async () => {
    await browser.reloadSession();
    await loginWebPersona('managerBlue');
    await openBlueProject();
    await waitForTestId('web-project-tab-map-layers');
    await byTestId('web-project-tab-map-layers').click();
    await waitForTestId('web-project-map-layers-empty');
    await captureStep({
      surface: 'web',
      label: 'project-map-layers-empty',
    });
  });
});
