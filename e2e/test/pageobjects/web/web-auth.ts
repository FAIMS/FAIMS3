import {browser, $} from '@wdio/globals';
import {Page} from '../page.ts';
import API_Login from '../api-login.ts';

const WEB_URL = process.env.WEB_URL || 'http://localhost:3001';

/**
 * Authentication helper for the web management dashboard.
 *
 * The dashboard has no local login page — unauthenticated requests are
 * redirected to the shared API login page (api/).  After a successful login
 * the API server redirects back to the dashboard with an `exchangeToken`
 * query parameter that the React app exchanges for session tokens stored in
 * localStorage.
 */
class WebAuth extends Page {
  /**
   * Perform the full redirect-based login flow:
   *  1. Navigate to the dashboard root → triggers redirect to API login.
   *  2. Fill in credentials using the API_Login page object.
   *  3. Wait for the post-login redirect back to the dashboard.
   *  4. Wait for the token exchange and initial render to complete.
   */
  async login(email: string, password: string) {
    // Navigate to dashboard root; wdio prepends baseUrl automatically so '/'
    // resolves to http://localhost:3001/ regardless of which conf is active.
    await browser.url(WEB_URL);
    await this.setBrowserSize();

    // The protected route redirects unauthenticated users to the API login page.
    await browser.waitUntil(
      async () => (await browser.getUrl()).includes('/login'),
      {
        timeout: 10000,
        timeoutMsg:
          'Expected redirect to API login page after navigating to the dashboard',
      }
    );

    // Fill the login form. We must NOT call API_Login.open() here — that would
    // navigate away from the current URL (which already contains the correct
    // ?redirect= parameter set by the server).
    await API_Login.waitForPageLoad();

    if (await API_Login.isLocalAuthAvailable()) {
      await API_Login.enterEmail(email);
      await API_Login.enterPassword(password);
      await API_Login.clickLogin();
    }

    // After a successful login the API server redirects the browser back to the
    // dashboard with ?exchangeToken=...&serverId=...
    await browser.waitUntil(
      async () => (await browser.getUrl()).startsWith(WEB_URL),
      {
        timeout: 15000,
        timeoutMsg: 'Expected redirect back to the web dashboard after login',
      }
    );

    // Wait for the TanStack Router beforeLoad (token exchange) and React
    // render to complete.
    await this.waitForPageLoad();

    // Mobile viewports use an off-canvas Sheet for the sidebar; data-sidebar="sidebar"
    // is only in the DOM when that sheet is open. The protected layout <main> is
    // always rendered once auth + token exchange complete.
    await browser.waitUntil(
      async () => {
        const url = await browser.getUrl();
        return (
          url.startsWith(WEB_URL) &&
          !url.includes('exchangeToken') &&
          (await $('main').isExisting())
        );
      },
      {
        timeout: 15000,
        timeoutMsg:
          'Expected authenticated dashboard (main content) after login',
      }
    );
  }

  /**
   * Returns true when the authenticated dashboard shell is present.
   */
  async isAuthenticated(): Promise<boolean> {
    const url = await browser.getUrl();
    return url.startsWith(WEB_URL) && (await $('main').isExisting());
  }
}

export default new WebAuth();
