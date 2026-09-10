import {$$, browser} from '@wdio/globals';
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

  /** Workspace Refresh control (triggers directory sync / remote cleanup). */
  get refreshButton() {
    return byTestId('app-notebooks-refresh-button');
  }

  /** Click Refresh and wait until it is enabled again. */
  async refreshNotebookList() {
    await this.refreshButton.waitForClickable({timeout: 15000});
    await this.refreshButton.click();
    await browser.waitUntil(
      async () => (await this.refreshButton.isEnabled()) === true,
      {
        timeout: 30000,
        timeoutMsg: 'Expected notebooks Refresh button to finish',
      }
    );
  }

  /** True if any notebook row on the current tab contains `name`. */
  async hasNotebookNamed(name: string): Promise<boolean> {
    return (await this.findNotebookRow(name)) !== undefined;
  }

  /** The notebook row on the current tab whose text contains `name`, if any. */
  async findNotebookRow(name: string) {
    const rows = await $$('[data-testid="app-notebook-row"]');
    for (const row of rows) {
      const text = await row.getText();
      if (text.includes(name)) {
        return row;
      }
    }
    return undefined;
  }

  /** Wait for the row named `name` on the current tab and return it. */
  async waitForNotebookRow(name: string, timeout = 30000) {
    await browser.waitUntil(async () => await this.hasNotebookNamed(name), {
      timeout,
      timeoutMsg: `Expected a notebook row named "${name}"`,
    });
    const row = await this.findNotebookRow(name);
    if (!row) {
      throw new Error(`Notebook row "${name}" disappeared`);
    }
    return row;
  }

  /** On the Active tab, click the row named `name` to open that notebook. */
  async openActiveNotebookNamed(name: string) {
    await this.waitForActiveNotebookNamed(name);
    const row = await this.waitForNotebookRow(name);
    await row.click();
    await browser.waitUntil(
      async () => /\/(surveys|notebooks)\//.test(await browser.getUrl()),
      {timeout: 15000, timeoutMsg: `Expected to navigate into "${name}"`}
    );
  }

  /**
   * On Not Active tab, activate the notebook whose row contains `name`.
   */
  async activateNotebookNamed(name: string) {
    await this.openNotActiveTab();
    await browser.waitUntil(async () => await this.hasNotebookNamed(name), {
      timeout: 30000,
      timeoutMsg: `Expected not-active notebook named "${name}"`,
    });
    const rows = await $$('[data-testid="app-notebook-row"]');
    for (const row of rows) {
      const text = await row.getText();
      if (!text.includes(name)) continue;
      const activate = await row.$(
        '[data-testid="app-notebook-activate-button"]'
      );
      await activate.waitForClickable({timeout: 10000});
      await activate.click();
      await this.confirmActivation();
      return;
    }
    throw new Error(`Could not find activate control for notebook "${name}"`);
  }

  /** Wait until Active tab lists a notebook named `name`. */
  async waitForActiveNotebookNamed(name: string) {
    await browser.waitUntil(
      async () =>
        (await this.activeTab.isEnabled().catch(() => false)) === true,
      {
        timeout: 30000,
        timeoutMsg: 'Expected Active notebooks tab to become enabled',
      }
    );
    await this.openActiveTab();
    await browser.waitUntil(async () => await this.hasNotebookNamed(name), {
      timeout: 30000,
      timeoutMsg: `Expected active notebook named "${name}"`,
    });
  }

  /** Wait until neither Active nor Not Active tabs list `name`. */
  async waitForNotebookGone(name: string) {
    await browser.waitUntil(
      async () => {
        const activeEnabled = await this.activeTab
          .isEnabled()
          .catch(() => false);
        if (activeEnabled) {
          await this.openActiveTab();
          if (await this.hasNotebookNamed(name)) return false;
        }
        await this.openNotActiveTab();
        return !(await this.hasNotebookNamed(name));
      },
      {
        timeout: 30000,
        timeoutMsg: `Expected notebook "${name}" to be removed locally`,
      }
    );
  }
}

export default new AppNotebooksPage();
