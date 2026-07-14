import {browser} from '@wdio/globals';
import {Page} from '../page.ts';
import {getWebUrl} from '../../helpers/env.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';

/**
 * Page object for the User Profile page (/profile).
 */
class WebProfilePage extends Page {
  public async open() {
    await browser.url(`${getWebUrl()}/profile`);
    await this.setBrowserSize();
    await this.waitForPageLoad();
    await this.waitForProfileReady();
  }

  async waitForProfileReady() {
    await waitForTestId('web-profile-heading', {
      timeout: 15000,
      timeoutMsg: 'Expected User Profile heading on /profile',
    });
  }

  get heading() {
    return byTestId('web-profile-heading');
  }

  get changePasswordButton() {
    return byTestId('web-profile-change-password-button');
  }

  get manageTokensButton() {
    return byTestId('web-profile-tokens-link');
  }

  async isPageDisplayed(): Promise<boolean> {
    try {
      await this.waitForProfileReady();
      return true;
    } catch {
      return false;
    }
  }

  async getPageText(): Promise<string> {
    await this.waitForProfileReady();
    const main = await byTestId('web-main');
    await main.waitForExist({timeout: 10000});
    return main.getText();
  }

  async waitForChangePasswordButton() {
    await this.changePasswordButton.scrollIntoView();
    await this.changePasswordButton.waitForDisplayed({timeout: 10000});
  }

  async waitForManageTokensButton() {
    await this.manageTokensButton.scrollIntoView();
    await this.manageTokensButton.waitForDisplayed({timeout: 10000});
  }

  async isChangePasswordButtonDisplayed(): Promise<boolean> {
    try {
      await this.waitForChangePasswordButton();
      return true;
    } catch {
      return false;
    }
  }

  async isManageTokensButtonDisplayed(): Promise<boolean> {
    try {
      await this.waitForManageTokensButton();
      return true;
    } catch {
      return false;
    }
  }
}

export default new WebProfilePage();
