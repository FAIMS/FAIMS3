import {$, browser} from '@wdio/globals';
import {Page} from '../page.ts';

const WEB_URL = process.env.WEB_URL || 'http://localhost:3001';

/**
 * Page object for the User Profile page (/_protected/profile/).
 *
 * The page renders:
 *  - An <h1>User Profile</h1> heading.
 *  - A card listing Email, Name, and Email Verification status.
 *  - A "Change Password" button (navigates to the API change-password page).
 *  - A "Manage Long-Lived Tokens" button (links to /profile/long-lived-tokens).
 */
class WebProfilePage extends Page {
  /**
   * Navigate to the profile page.
   * Uses a root-relative URL so wdio prepends the configured baseUrl.
   */
  public async open() {
    await browser.url(`${WEB_URL}/profile`);
    await this.setBrowserSize();
    await this.waitForPageLoad();
    await this.waitForProfileReady();
  }

  /** Wait until the profile route has rendered (not login redirect). */
  async waitForProfileReady() {
    await this.heading.waitForDisplayed({
      timeout: 15000,
      timeoutMsg: 'Expected User Profile heading on /profile',
    });
  }

  /** Page heading — always "User Profile". */
  get heading() {
    return $('h1=User Profile');
  }

  /**
   * "Change Password" button.
   * Redirects to the API change-password page with the current user's email
   * pre-filled and a redirect back to the profile page.
   */
  get changePasswordButton() {
    return $('button=Change Password');
  }

  /**
   * Control for /profile/long-lived-tokens (TanStack Link wrapping a Button).
   */
  get manageTokensButton() {
    return $('a[href*="long-lived-tokens"]');
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
    const main = await $('main');
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
