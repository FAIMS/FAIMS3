/**
 * Create project dialog from projects list.
 */
import {loginWebPersona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import WebProjectsPage from '../../pageobjects/web/web-projects.ts';

describe('Web Dashboard — Projects create', () => {
  before(async () => {
    await browser.reloadSession();
    await loginWebPersona('redMemberCreator');
  });

  it('should open create project dialog', async () => {
    await WebProjectsPage.open();
    await WebProjectsPage.openCreateDialog();
    await expect(byTestId('web-projects-create-dialog')).toBeDisplayed();
    await expect(byTestId('web-projects-create-name')).toBeDisplayed();
    await captureStep({
      surface: 'web',
      label: 'create-project-dialog',
    });
  });

  it('should show submit control in create dialog', async () => {
    await WebProjectsPage.open();
    await WebProjectsPage.openCreateDialog();
    await expect(byTestId('web-projects-create-submit')).toBeDisplayed();
    await captureStep({
      surface: 'web',
      label: 'create-project-submit',
    });
  });
});
