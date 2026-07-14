import {$, $$, browser} from '@wdio/globals';
import {Page} from '../page.ts';
import {getWebUrl} from '../../helpers/env.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';

/**
 * Page object for the Projects list page (/projects).
 */
class WebProjectsPage extends Page {
  public async open() {
    await browser.url(`${getWebUrl()}/projects`);
    await this.setBrowserSize();
    await this.waitForPageLoad();
    await this.waitForProjectsReady();
  }

  async waitForProjectsReady() {
    await waitForTestId('web-projects-heading', {
      timeout: 15000,
      timeoutMsg: 'Expected projects list heading on /projects',
    });
  }

  get heading() {
    return byTestId('web-projects-heading');
  }

  get projectsTable() {
    return $('table');
  }

  get createButton() {
    return byTestId('web-projects-create-button');
  }

  get createDialog() {
    return byTestId('web-projects-create-dialog');
  }

  get nameInput() {
    return byTestId('web-projects-create-name');
  }

  get submitButton() {
    return byTestId('web-projects-create-submit');
  }

  async isPageDisplayed(): Promise<boolean> {
    try {
      await this.waitForProjectsReady();
      return true;
    } catch {
      return false;
    }
  }

  async waitForCreateButton() {
    await this.createButton.scrollIntoView();
    await this.createButton.waitForDisplayed({timeout: 10000});
  }

  async getProjectRowCount(): Promise<number> {
    const rows = await $$('tbody tr');
    return rows.length;
  }

  async isCreateButtonDisplayed(): Promise<boolean> {
    try {
      await this.waitForCreateButton();
      return true;
    } catch {
      return false;
    }
  }

  async openCreateDialog() {
    await this.waitForCreateButton();
    await this.createButton.click();
    await waitForTestId('web-projects-create-dialog');
  }
}

export default new WebProjectsPage();
