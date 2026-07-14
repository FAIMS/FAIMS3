import {browser, $} from '@wdio/globals';
import {Page} from '../page.ts';
import {loginWeb} from '../../helpers/auth.ts';
import {getWebUrl} from '../../helpers/env.ts';

/**
 * Authentication helper for the web management dashboard.
 *
 * Thin wrapper around helpers/auth.ts loginWeb for page-object style usage.
 */
class WebAuth extends Page {
  /**
   * Perform the full redirect-based login flow.
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
