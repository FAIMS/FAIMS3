import {browser} from '@wdio/globals';
import {Page} from '../page.ts';
import {getWebUrl} from '../../helpers/env.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';

/**
 * Page object for the Templates list page (/templates).
 *
 * Covers the list heading, create-template dialog trigger, and create dialog fields.
 */
class WebTemplatesPage extends Page {
  /**
   * Navigate to the templates page.
   * Uses getWebUrl() so the absolute Control Centre origin is correct regardless
   * of which WDIO conf / baseUrl is active.
   */
  public async open() {
    await browser.url(`${getWebUrl()}/templates`);
    await this.setBrowserSize();
    await this.waitForPageLoad();
    await waitForTestId('web-templates-heading');
  }

  /** Page heading for the templates list. */
  get heading() {
    return byTestId('web-templates-heading');
  }

  /** "Create Template" dialog-trigger button. */
  get createButton() {
    return byTestId('web-templates-create-button');
  }

  /** Create-template dialog shell. */
  get createDialog() {
    return byTestId('web-templates-create-dialog');
  }

  /** Name field inside the create-template dialog. */
  get nameInput() {
    return byTestId('web-templates-create-name');
  }

  /** Submit control inside the create-template dialog. */
  get submitButton() {
    return byTestId('web-templates-create-submit');
  }

  /** Open the create-template dialog and wait for it to appear. */
  async openCreateDialog() {
    await this.createButton.waitForClickable({timeout: 10000});
    await this.createButton.click();
    await waitForTestId('web-templates-create-dialog');
  }

  /** Create a template with the given name and wait for the dialog to close. */
  async createTemplate(name: string) {
    await this.openCreateDialog();
    await this.nameInput.setValue(name);
    await this.submitButton.waitForClickable();
    await this.submitButton.click();
    await this.createDialog.waitForDisplayed({reverse: true, timeout: 15000});
  }

  /** Returns true when the templates heading is visible. */
  async isPageDisplayed(): Promise<boolean> {
    try {
      await waitForTestId('web-templates-heading');
      return true;
    } catch {
      return false;
    }
  }
}

export default new WebTemplatesPage();
