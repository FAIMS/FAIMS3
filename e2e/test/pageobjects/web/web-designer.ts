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

  /** Publish current notebook design (primary persist control). */
  get saveButton() {
    return byTestId('web-designer-save-button');
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

  /** Click Publish changes. */
  async save() {
    await this.saveButton.waitForClickable({timeout: 10000});
    await this.saveButton.click();
  }

  /** Click Close. */
  async close() {
    await this.closeButton.waitForClickable({timeout: 10000});
    await this.closeButton.click();
  }

  /** Confirm Publish changes in the confirmation dialog. */
  async confirmPublish() {
    const confirm = byTestId('web-designer-publish-confirm-button');
    await confirm.waitForClickable({timeout: 10000});
    await confirm.click();
  }

  /** Keep the local draft and leave the overlay. */
  async closeKeepDraft() {
    const keepDraft = byTestId('web-designer-close-keep-draft-button');
    await keepDraft.waitForClickable({timeout: 10000});
    await keepDraft.click();
  }

  /** Add a named form so the session has unpublished changes. */
  async addForm(name: string) {
    await this.newFormButton.waitForClickable({timeout: 10000});
    await this.newFormButton.click();
    const input = byTestId('formNameDialog');
    await input.waitForDisplayed({timeout: 10000});
    await input.setValue(name);
    const add = await $('button=Add Form');
    await add.waitForClickable({timeout: 10000});
    await add.click();
  }
}

export default new WebDesignerPage();
