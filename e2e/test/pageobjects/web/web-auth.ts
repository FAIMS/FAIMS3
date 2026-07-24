import {browser, $} from '@wdio/globals';
import {Page} from '../page.ts';
import {loginWeb} from '../../helpers/auth.ts';
import {getWebUrl} from '../../helpers/env.ts';

/**
 * Authentication helper for the web management dashboard.
 *
 * Thin wrapper around helpers/auth.ts `loginWeb` for page-object style usage.
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
   *
   * Implementation lives in helpers/auth.ts `loginWeb`.
   */
  async login(email: string, password: string) {
    await this.setBrowserSize();
    await loginWeb({email, password});
  }

  /**
   * Returns true when the authenticated dashboard shell is present.
   */
  async isAuthenticated(): Promise<boolean> {
    const webUrl = getWebUrl();
    const url = await browser.getUrl();
    return url.startsWith(webUrl) && (await $('main').isExisting());
  }
}

export default new WebAuth();
