import {Page} from '../page.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';

/**
 * Designer shell page object (overlay opened from template/project actions).
 */
class WebDesignerPage extends Page {
  get shell() {
    return byTestId('web-designer-shell');
  }

  get saveButton() {
    return byTestId('web-designer-save-button');
  }

  get cancelButton() {
    return byTestId('web-designer-cancel-button');
  }

  get closeButton() {
    return byTestId('web-designer-close-button');
  }

  get newFormButton() {
    return byTestId('web-designer-new-form-button');
  }

  async waitForOpen() {
    await waitForTestId('web-designer-shell', {timeout: 20000});
  }

  async isOpen(): Promise<boolean> {
    return this.shell.isDisplayed().catch(() => false);
  }

  async save() {
    await this.saveButton.waitForClickable({timeout: 10000});
    await this.saveButton.click();
  }

  async cancel() {
    await this.cancelButton.waitForClickable({timeout: 10000});
    await this.cancelButton.click();
  }
}

export default new WebDesignerPage();
