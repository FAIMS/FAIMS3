/**
 * Control Centre login shell + sidebar + profile landmark.
 */
import {loginWebPersona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';

describe('Smoke — Web login shell', () => {
  before(async () => {
    await browser.reloadSession();
    await loginWebPersona('memberBoth');
  });

  it('should render authenticated main shell', async () => {
    await waitForTestId('web-main');
    await expect(byTestId('web-main')).toBeDisplayed();
    await captureStep({surface: 'web', label: 'web-main'});
  });

  it('should show primary sidebar nav items', async () => {
    await expect(byTestId('web-sidebar')).toBeDisplayed();
    await expect(byTestId('web-nav-teams')).toBeDisplayed();
    await expect(byTestId('web-nav-projects')).toBeDisplayed();
    await expect(byTestId('web-nav-templates')).toBeDisplayed();
    await captureStep({surface: 'web', label: 'sidebar-nav'});
  });

  it('should open profile from user menu', async () => {
    await byTestId('web-nav-user-menu').click();
    await waitForTestId('web-nav-profile');
    await byTestId('web-nav-profile').click();
    await waitForTestId('web-profile-heading');
    expect(await browser.getUrl()).toContain('/profile');
    await captureStep({surface: 'web', label: 'profile'});
  });
});
