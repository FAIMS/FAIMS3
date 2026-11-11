/**
 * Map layers library after Control Centre login. Seed has no map assets, so
 * an empty table is the expected state. Uploads need the spatial worker and
 * are out of scope for smoke.
 */
import {loginWebPersona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';
import {getWebUrl} from '../../helpers/env.ts';

describe('Smoke — Web map layers list', () => {
  it('should display the map layers library (empty is valid)', async () => {
    await browser.reloadSession();
    await loginWebPersona('memberBoth');
    await browser.url(`${getWebUrl()}/map-layers`);
    await waitForTestId('web-map-layers-heading');
    await expect(byTestId('web-map-layers-heading')).toBeDisplayed();
    await waitForTestId('web-data-table-empty');
    await expect(byTestId('web-map-layers-create-button')).not.toBeExisting();
    await captureStep({
      surface: 'web',
      label: 'map-layers-empty',
    });
  });
});
