import {Page} from '../page.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';

/**
 * Designer shell page object (overlay opened from template/project actions).
 */
class WebDesignerPage extends Page {
  /** Root shell of the designer overlay. */
  get shell() {
    return byTestId('web-designer-shell');
  }

  /** Persist current notebook design. */
  get saveButton() {
    return byTestId('web-designer-save-button');
  }

  /** Discard / cancel designer changes. */
  get cancelButton() {
    return byTestId('web-designer-cancel-button');
  }

  /** Close the designer overlay. */
  get closeButton() {
    return byTestId('web-designer-close-button');
  }

  /** Add a new form within the designer. */
  get newFormButton() {
    return byTestId('web-designer-new-form-button');
  }

  /** Wait until the designer shell is present in the DOM. */
  async waitForOpen() {
    await waitForTestId('web-designer-shell', {timeout: 20000});
  }

  /** Returns true when the designer shell is displayed. */
  async isOpen(): Promise<boolean> {
    return this.shell.isDisplayed().catch(() => false);
  }

  /** Click Save. */
  async save() {
    await this.saveButton.waitForClickable({timeout: 10000});
    await this.saveButton.click();
  }

  /** Click Cancel. */
  async cancel() {
    await this.cancelButton.waitForClickable({timeout: 10000});
    await this.cancelButton.click();
  }
}

export default new WebDesignerPage();
