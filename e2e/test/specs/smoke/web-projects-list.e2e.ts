/**
 * Projects list smoke after Control Centre login.
 */
import {loginWebPersona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';
import {getWebUrl} from '../../helpers/env.ts';

describe('Smoke — Web projects list', () => {
  it('should display the projects list page (team member)', async () => {
    await browser.reloadSession();
    await loginWebPersona('memberBoth');
    await browser.url(`${getWebUrl()}/projects`);
    await waitForTestId('web-projects-heading');
    await expect(byTestId('web-projects-heading')).toBeDisplayed();
    await captureStep({
      surface: 'web',
      label: 'projects-list',
    });
  });

  it('should show create project button for team member creator', async () => {
    await browser.reloadSession();
    // TEAM_MEMBER cannot create; TEAM_MEMBER_CREATOR can
    await loginWebPersona('redMemberCreator');
    await browser.url(`${getWebUrl()}/projects`);
    await waitForTestId('web-projects-create-button');
    await expect(byTestId('web-projects-create-button')).toBeDisplayed();
    await captureStep({
      surface: 'web',
      label: 'create-button',
    });
  });
});
