import {$, $$, browser} from '@wdio/globals';
import {Page} from '../page.ts';

/**
 * Page object for the Projects list page (/_protected/projects/).
 *
 * The page renders:
 *  - An <h1> heading whose text is derived from NOTEBOOK_NAME_PLURAL_CAPITALIZED
 *    (e.g. "Notebooks").
 *  - A ShadCN DataTable that wraps a standard <table> element.
 *  - A "Create {NotebookName}" dialog-trigger button.
 */
class WebProjectsPage extends Page {
  /**
   * Navigate to the projects page.
   * Uses a root-relative URL so wdio prepends the configured baseUrl.
   */
  public async open() {
    await browser.url('/projects');
    await this.setBrowserSize();
    await this.waitForPageLoad();
  }

  /** Page heading — text varies by deployment (e.g. "Notebooks"). */
  get heading() {
    return $('h1');
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
   * Text starts with "Create " regardless of the configured notebook name.
   */
  get createButton() {
    return $('button*=Create');
  }

  /**
   * Returns true when the main content container is displayed, indicating
   * the page has loaded (regardless of whether any projects exist).
   */
  async isPageDisplayed(): Promise<boolean> {
    return this.heading.isDisplayed();
  }

  /** Number of data rows in the projects table (excludes header row). */
  async getProjectRowCount(): Promise<number> {
    const rows = await $$('tbody tr');
    return rows.length;
  }

  async isCreateButtonDisplayed(): Promise<boolean> {
    return this.createButton.isDisplayed();
  }
}

export default new WebProjectsPage();
