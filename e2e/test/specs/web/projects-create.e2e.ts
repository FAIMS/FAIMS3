/**
 * Workflows: P2, P3, P8
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

  it('P2: should open create project dialog', async () => {
    await WebProjectsPage.open();
    await WebProjectsPage.openCreateDialog();
    await expect(byTestId('web-projects-create-dialog')).toBeDisplayed();
    await expect(byTestId('web-projects-create-name')).toBeDisplayed();
    await captureStep({
      surface: 'web',
      workflowId: 'P2',
      label: 'create-project-dialog',
    });
  });

  it('P3: should show submit control in create dialog', async () => {
    await WebProjectsPage.open();
    await WebProjectsPage.openCreateDialog();
    await expect(byTestId('web-projects-create-submit')).toBeDisplayed();
    await captureStep({
      surface: 'web',
      workflowId: 'P3',
      label: 'create-project-submit',
    });
  });
});
