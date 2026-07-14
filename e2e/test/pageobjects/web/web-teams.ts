import {$, browser} from '@wdio/globals';
import {Page} from '../page.ts';
import {getWebUrl} from '../../helpers/env.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';

/**
 * Page object for the Teams list page (/teams).
 *
 * Covers the list heading, create-team dialog trigger, and create dialog fields.
 */
class WebTeamsPage extends Page {
  /**
   * Navigate to the teams page.
   * Uses getWebUrl() so the absolute Control Centre origin is correct regardless
   * of which WDIO conf / baseUrl is active.
   */
  public async open() {
    await browser.url(`${getWebUrl()}/teams`);
    await this.setBrowserSize();
    await this.waitForPageLoad();
    await waitForTestId('web-teams-heading');
  }

  /** Page heading for the teams list. */
  get heading() {
    return byTestId('web-teams-heading');
  }

  /** "Create Team" dialog-trigger button. */
  get createButton() {
    return byTestId('web-teams-create-button');
  }

  /** Create-team dialog shell. */
  get createDialog() {
    return byTestId('web-teams-create-dialog');
  }

  /** Name field inside the create-team dialog. */
  get nameInput() {
    return byTestId('web-teams-create-name');
  }

  /** Submit control inside the create-team dialog. */
  get submitButton() {
    return byTestId('web-teams-create-submit');
  }

  /** Open the create-team dialog and wait for it to appear. */
  async openCreateDialog() {
    await this.createButton.waitForClickable({timeout: 10000});
    await this.createButton.click();
    await waitForTestId('web-teams-create-dialog');
  }

  /**
   * Create a team with the given name (and optional description), then wait
   * until the dialog closes or the team name appears in main content.
   */
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

  /** Returns true when the teams heading is visible. */
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
