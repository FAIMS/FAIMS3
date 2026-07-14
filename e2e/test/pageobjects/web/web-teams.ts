import {$, browser} from '@wdio/globals';
import {Page} from '../page.ts';
import {getWebUrl} from '../../helpers/env.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';

/**
 * Teams list + create dialog page object.
 */
class WebTeamsPage extends Page {
  public async open() {
    await browser.url(`${getWebUrl()}/teams`);
    await this.setBrowserSize();
    await this.waitForPageLoad();
    await waitForTestId('web-teams-heading');
  }

  get heading() {
    return byTestId('web-teams-heading');
  }

  get createButton() {
    return byTestId('web-teams-create-button');
  }

  get createDialog() {
    return byTestId('web-teams-create-dialog');
  }

  get nameInput() {
    return byTestId('web-teams-create-name');
  }

  get submitButton() {
    return byTestId('web-teams-create-submit');
  }

  async openCreateDialog() {
    await this.createButton.waitForClickable({timeout: 10000});
    await this.createButton.click();
    await waitForTestId('web-teams-create-dialog');
  }

  async createTeam(name: string, description?: string) {
    await this.openCreateDialog();
    await this.nameInput.setValue(name);
    const descText = description || 'Created by automated e2e suite';
    const desc = await $(
      'textarea[name="description"], input[name="description"], textarea'
    );
    await desc.waitForDisplayed({timeout: 5000});
    await desc.setValue(descText);
    await this.submitButton.waitForClickable();
    await this.submitButton.click();
    await browser.waitUntil(
      async () => {
        const dialogGone = !(await this.createDialog
          .isDisplayed()
          .catch(() => false));
        const listed = (await $('main').getText()).includes(name);
        return dialogGone || listed;
      },
      {
        timeout: 20000,
        timeoutMsg: 'Expected create-team dialog to close or team to appear',
      }
    );
  }

  async isPageDisplayed(): Promise<boolean> {
    try {
      await waitForTestId('web-teams-heading');
      return true;
    } catch {
      return false;
    }
  }
}

export default new WebTeamsPage();
