import {$, browser} from '@wdio/globals';
import {Page} from '../page.ts';

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
    await browser.url('/profile');
    await this.setBrowserSize();
    await this.waitForPageLoad();
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
   * "Manage Long-Lived Tokens" button/link.
   * Navigates to /profile/long-lived-tokens.
   */
  get manageTokensButton() {
    return $('button=Manage Long-Lived Tokens');
  }

  /** Returns true when the profile heading is visible. */
  async isPageDisplayed(): Promise<boolean> {
    return this.heading.isDisplayed();
  }

  /**
   * Returns the full visible text of the page's main content area.
   * Used to verify the logged-in user's email is shown on the page.
   */
  async getPageText(): Promise<string> {
    return $('main').getText();
  }

  async isChangePasswordButtonDisplayed(): Promise<boolean> {
    return this.changePasswordButton.isDisplayed();
  }

  async isManageTokensButtonDisplayed(): Promise<boolean> {
    return this.manageTokensButton.isDisplayed();
  }
}

export default new WebProfilePage();
