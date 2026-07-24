import {browser} from '@wdio/globals';
import {Page} from './page.ts';
import {getAppUrl} from '../helpers/env.ts';
import {byTestId} from '../helpers/selectors.ts';
import {waitForTestId} from '../helpers/wait.ts';

/**
 * Fieldmark notebook workspace (list + activate).
 */
class AppNotebooksPage extends Page {
  /** Open the app root (workspace / notebooks list). */
  public async open() {
    await browser.url(`${getAppUrl()}/`);
    await this.setBrowserSize();
    await this.waitForPageLoad();
  }

  /** Workspace heading. */
  get heading() {
    return byTestId('app-notebooks-heading');
  }

  /** Add / browse notebooks control. */
  get addButton() {
    return byTestId('app-notebooks-add-button');
  }

  /** "Active" notebooks tab. */
  get activeTab() {
    return byTestId('app-notebooks-tab-active');
  }

  /** "Not active" notebooks tab (inactive / available to activate). */
  get notActiveTab() {
    return byTestId('app-notebooks-tab-not-active');
  }

  /** Per-row activate action on the not-active list. */
  get activateButton() {
    return byTestId('app-notebook-activate-button');
  }

  /** Confirm control in the activate dialog. */
  get activateConfirm() {
    return byTestId('app-notebook-activate-confirm');
  }

  /** A notebook row in the current tab's list. */
  get notebookRow() {
    return byTestId('app-notebook-row');
  }

  /** Wait until the workspace heading is present. */
  async waitForWorkspace() {
    await waitForTestId('app-notebooks-heading', {timeout: 20000});
  }

  /** Switch to the Not active tab. */
  async openNotActiveTab() {
    await this.notActiveTab.waitForClickable({timeout: 10000});
    await this.notActiveTab.click();
  }

  /** Switch to the Active tab. */
  async openActiveTab() {
    await this.activeTab.waitForEnabled({timeout: 15000});
    await this.activeTab.click();
  }

  /** Open Not active and click the first available Activate control. */
  async activateFirstAvailable() {
    await this.openNotActiveTab();
    await this.activateButton.waitForClickable({timeout: 15000});
    await this.activateButton.click();
  }

  /** Confirm the activate dialog. */
  async confirmActivation() {
    await this.activateConfirm.waitForClickable({timeout: 10000});
    await this.activateConfirm.click();
  }
}

export default new AppNotebooksPage();
