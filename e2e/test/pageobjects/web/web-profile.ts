import {browser} from '@wdio/globals';
import {Page} from '../page.ts';
import {getWebUrl} from '../../helpers/env.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';

/**
 * Page object for the User Profile page (/profile).
 *
 * The page renders:
 *  - A heading (data-testid web-profile-heading).
 *  - A card listing Email, Name, and Email Verification status.
 *  - A "Change Password" button (navigates to the API change-password page).
 *  - A "Manage Long-Lived Tokens" control (links to /profile/long-lived-tokens).
 */
class WebProfilePage extends Page {
  /**
   * Navigate to the profile page.
   * Uses getWebUrl() so the absolute Control Centre origin is correct regardless
   * of which WDIO conf / baseUrl is active.
   */
  public async open() {
    await browser.url(`${getWebUrl()}/profile`);
    await this.setBrowserSize();
    await this.waitForPageLoad();
    await this.waitForProfileReady();
  }

  /** Wait until the profile route has rendered (not login redirect). */
  async waitForProfileReady() {
    await waitForTestId('web-profile-heading', {
      timeout: 15000,
      timeoutMsg: 'Expected User Profile heading on /profile',
    });
  }

  /** Page heading — always "User Profile". */
  get heading() {
    return byTestId('web-profile-heading');
  }

  /**
   * "Change Password" button.
   * Redirects to the API change-password page with the current user's email
   * pre-filled and a redirect back to the profile page.
   */
  get changePasswordButton() {
    return byTestId('web-profile-change-password-button');
  }

  /**
   * Control for /profile/long-lived-tokens (TanStack Link wrapping a Button).
   */
  get manageTokensButton() {
    return byTestId('web-profile-tokens-link');
  }

  /** Returns true when the profile heading is visible. */
  async isPageDisplayed(): Promise<boolean> {
    try {
      await this.waitForProfileReady();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Returns the full visible text of the page's main content area.
   * Used to verify the logged-in user's email is shown on the page.
   */
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
