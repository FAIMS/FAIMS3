import {browser} from '@wdio/globals';
import {Page} from './page.ts';
import {getAppUrl} from '../helpers/env.ts';
import {byTestId} from '../helpers/selectors.ts';
import {waitForTestId} from '../helpers/wait.ts';

/**
 * Fieldmark notebook workspace (list + activate).
 */
class AppNotebooksPage extends Page {
  public async open() {
    await browser.url(`${getAppUrl()}/`);
    await this.setBrowserSize();
    await this.waitForPageLoad();
  }

  get heading() {
    return byTestId('app-notebooks-heading');
  }

  get addButton() {
    return byTestId('app-notebooks-add-button');
  }

  get activeTab() {
    return byTestId('app-notebooks-tab-active');
  }

  get notActiveTab() {
    return byTestId('app-notebooks-tab-not-active');
  }

  get activateButton() {
    return byTestId('app-notebook-activate-button');
  }

  get activateConfirm() {
    return byTestId('app-notebook-activate-confirm');
  }

  get notebookRow() {
    return byTestId('app-notebook-row');
  }

  async waitForWorkspace() {
    await waitForTestId('app-notebooks-heading', {timeout: 20000});
  }

  async openNotActiveTab() {
    await this.notActiveTab.waitForClickable({timeout: 10000});
    await this.notActiveTab.click();
  }

  async openActiveTab() {
    await this.activeTab.waitForEnabled({timeout: 15000});
    await this.activeTab.click();
  }

  async activateFirstAvailable() {
    await this.openNotActiveTab();
    await this.activateButton.waitForClickable({timeout: 15000});
    await this.activateButton.click();
  }

  async confirmActivation() {
    await this.activateConfirm.waitForClickable({timeout: 10000});
    await this.activateConfirm.click();
  }
}

export default new AppNotebooksPage();
