import {browser} from '@wdio/globals';
import {Page} from '../page.ts';
import {getWebUrl} from '../../helpers/env.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';

/**
 * Templates list + create dialog page object.
 */
class WebTemplatesPage extends Page {
  public async open() {
    await browser.url(`${getWebUrl()}/templates`);
    await this.setBrowserSize();
    await this.waitForPageLoad();
    await waitForTestId('web-templates-heading');
  }

  get heading() {
    return byTestId('web-templates-heading');
  }

  get createButton() {
    return byTestId('web-templates-create-button');
  }

  get createDialog() {
    return byTestId('web-templates-create-dialog');
  }

  get nameInput() {
    return byTestId('web-templates-create-name');
  }

  get submitButton() {
    return byTestId('web-templates-create-submit');
  }

  async openCreateDialog() {
    await this.createButton.waitForClickable({timeout: 10000});
    await this.createButton.click();
    await waitForTestId('web-templates-create-dialog');
  }

  async createTemplate(name: string) {
    await this.openCreateDialog();
    await this.nameInput.setValue(name);
    await this.submitButton.waitForClickable();
    await this.submitButton.click();
    await this.createDialog.waitForDisplayed({reverse: true, timeout: 15000});
  }

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
