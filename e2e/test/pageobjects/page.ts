import {browser, $, $$} from '@wdio/globals';
import {getAppUrl, loadE2eEnv} from '../helpers/env.ts';
import {captureDocs} from '../helpers/screenshot.ts';
import {applyViewport, getViewportConfig} from '../helpers/viewport.ts';

loadE2eEnv();

/**
 * Base page object class
 */
export class Page {
  /**
   * Check if running on mobile platform
   */
  protected isMobilePlatform(): boolean {
    return (
      browser.isMobile ||
      process.env.PLATFORM === 'android' ||
      process.env.PLATFORM === 'ios'
    );
  }
  /**
   * Switch to webview context for Capacitor apps
   */
  private async switchToWebviewContext() {
    if (!this.isMobilePlatform()) return;

    const contexts = await browser.getContexts();
    console.log('Available contexts:', contexts);

    const webviewContext = contexts.find(
      context =>
        context.toString().includes('WEBVIEW') &&
        context.toString().includes('au.edu.faims.fieldmark')
    );

    if (webviewContext) {
      console.log(`Switching to webview context: ${webviewContext}`);
      await browser.switchContext(webviewContext);
    } else {
      throw new Error(
        `Fieldmark webview context not found. Available contexts: ${contexts.join(', ')}`
      );
    }
  }

  /**
   * Set browser viewport based on environment configuration.
   * Uses devicePixelRatio=1 so screenshots are not horizontally stretched.
   */
  public async setBrowserSize() {
    if (this.isMobilePlatform()) {
      console.log('Skipping browser size setting for mobile platform');
      return;
    }

    await applyViewport(getViewportConfig());
  }

  /**
   * Open a sub page of the Fieldmark app root (WEB_APP_PUBLIC_URL).
   * @param path path of the sub page (e.g. /signin)
   */
  public async open(path = '') {
    if (this.isMobilePlatform()) {
      // Documented: Capacitor app needs settle time before webview switch.
      await browser.pause(3000);
      await this.switchToWebviewContext();
      console.log(`Mobile app should navigate to: ${path}`);
      await this.waitForPageLoad();
    } else {
      const base = getAppUrl();
      const suffix = path.replace(/^\//, '');
      await browser.url(suffix ? `${base}/${suffix}` : `${base}/`);
      await this.setBrowserSize();
      await this.waitForPageLoad();
    }
  }

  /**
   * Wait for page to be loaded
   */
  public async waitForPageLoad() {
    if (this.isMobilePlatform()) {
      // Wait for webview content and debug what's there
      await browser.waitUntil(
        async () => {
          try {
            const body = await $('body');
            return await body.isExisting();
          } catch {
            return false;
          }
        },
        {
          timeout: 15000,
          timeoutMsg: 'Webview content not ready within 15 seconds',
        }
      );

      try {
        // Debug: log current page info
        const url = await browser.getUrl();
        const title = await browser.getTitle();
        const bodyText = await $('body').getText();
        console.log(`Current URL: ${url}`);
        console.log(`Page title: ${title}`);
        console.log(`Body content preview: ${bodyText.substring(0, 200)}...`);

        // Try to find any elements with data-testid
        const testElements = await $$('[data-testid]');
        const testElementCount = await testElements.length;
        console.log(`Found ${testElementCount} elements with data-testid`);

        for (let i = 0; i < Math.min(testElementCount, 5); i++) {
          const testId = await testElements[i].getAttribute('data-testid');
          console.log(`  - data-testid="${testId}"`);
        }
      } catch (error) {
        console.log(
          'Debug info failed:',
          error instanceof Error ? error.message : error
        );
      }
    } else {
      await browser.waitUntil(
        () => browser.execute(() => document.readyState === 'complete'),
        {
          timeout: 10000,
          timeoutMsg: 'Page did not load within 10 seconds',
        }
      );
    }
  }

  /**
   * Take a docs-oriented screenshot (delegates to captureDocs helper).
   */
  public async takeScreenshot(category: string, baseName: string) {
    const filename = await captureDocs({category, baseName});
    console.log(
      `Taking screenshot: ${baseName}-${process.env.VIEWPORT || 'desktop'}.png`
    );
    return filename ?? `${baseName}-${process.env.VIEWPORT || 'desktop'}`;
  }
}
