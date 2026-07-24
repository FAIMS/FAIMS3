import {$, $$, browser} from '@wdio/globals';
import {Page} from '../page.ts';
import {getWebUrl} from '../../helpers/env.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';

/**
 * Page object for the Projects list page (/projects).
 *
 * The page renders:
 *  - An <h1> heading whose text is derived from NOTEBOOK_NAME_PLURAL_CAPITALIZED
 *    (e.g. "Notebooks") — selected via data-testid web-projects-heading.
 *  - A ShadCN DataTable that wraps a standard <table> element.
 *  - A "Create {NotebookName}" dialog-trigger button.
 */
class WebProjectsPage extends Page {
  /**
   * Navigate to the projects page.
   * Uses getWebUrl() so the absolute Control Centre origin is correct regardless
   * of which WDIO conf / baseUrl is active.
   */
  public async open() {
    await browser.url(`${getWebUrl()}/projects`);
    await this.setBrowserSize();
    await this.waitForPageLoad();
    await this.waitForProjectsReady();
  }

  /** Wait until the projects list heading has rendered (not login redirect). */
  async waitForProjectsReady() {
    await waitForTestId('web-projects-heading', {
      timeout: 15000,
      timeoutMsg: 'Expected projects list heading on /projects',
    });
  }

  /** Page heading — text varies by deployment (e.g. "Notebooks"). */
  get heading() {
    return byTestId('web-projects-heading');
  }

  /**
   * The DataTable's <table> element.
   * Present when there is at least one project row or the table header is rendered.
   */
  get projectsTable() {
    return $('table');
  }

  /**
   * The "Create {NotebookName}" dialog-trigger button.
   * Label text starts with "Create " regardless of the configured notebook name;
   * the stable selector is data-testid web-projects-create-button.
   */
  get createButton() {
    return byTestId('web-projects-create-button');
  }

  /** Create-project dialog shell (opened by createButton). */
  get createDialog() {
    return byTestId('web-projects-create-dialog');
  }

  /** Name field inside the create-project dialog. */
  get nameInput() {
    return byTestId('web-projects-create-name');
  }

  /** Submit control inside the create-project dialog. */
  get submitButton() {
    return byTestId('web-projects-create-submit');
  }

  /**
   * Returns true when the projects heading is displayed, indicating
   * the page has loaded (regardless of whether any projects exist).
   */
  async isPageDisplayed(): Promise<boolean> {
    try {
      await this.waitForProjectsReady();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for the create button to become visible (it is rendered after the data
   * fetch resolves, even when the list is empty).
   */
  async waitForCreateButton() {
    await this.createButton.scrollIntoView();
    await this.createButton.waitForDisplayed({timeout: 10000});
  }

  /** Number of data rows in the projects table (excludes header row). */
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

  /** Open the create-project dialog and wait for it to appear. */
  async openCreateDialog() {
    await this.waitForCreateButton();
    await this.createButton.click();
    await waitForTestId('web-projects-create-dialog');
  }
}

export default new WebProjectsPage();
