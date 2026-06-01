import {browser} from '@wdio/globals';
import {mkdirSync} from 'fs';
const baseURL = 'http://localhost:3000/';

/**
 * Common viewport sizes for testing
 */
const VIEWPORTS = {
  mobile: {width: 430, height: 932}, // iPhone 14 Pro Max
  tablet: {width: 1024, height: 768}, // iPad
  desktop: {width: 1280, height: 720}, // Desktop
  wide: {width: 1920, height: 1080}, // Full HD
};

// write screenshots to a configurable location
const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || './screenshots';

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
   * Get viewport configuration from environment
   */
  private getViewportConfig() {
    // Mobile platforms don't need viewport setting
    if (this.isMobilePlatform()) {
      return {width: 0, height: 0, name: process.env.PLATFORM || 'mobile'};
    }

    const viewportName = process.env.VIEWPORT || 'desktop';
    const customWidth = process.env.SCREEN_WIDTH;
    const customHeight = process.env.SCREEN_HEIGHT;

    // Use custom dimensions if provided
    if (customWidth && customHeight) {
      return {
        width: parseInt(customWidth),
        height: parseInt(customHeight),
        name: 'custom',
      };
    }

    // Use predefined viewport
    const viewport = VIEWPORTS[viewportName as keyof typeof VIEWPORTS];
    if (!viewport) {
      console.warn(`Unknown viewport: ${viewportName}, using desktop`);
      return {...VIEWPORTS.desktop, name: 'desktop'};
    }

    return {...viewport, name: viewportName};
  }

  /**
   * Set browser window size based on environment configuration
   */
  public async setBrowserSize() {
    if (this.isMobilePlatform()) {
      console.log('Skipping browser size setting for mobile platform');
      return;
    }

    const {width, height, name} = this.getViewportConfig();
    console.log(`Setting browser size to ${width}x${height} (${name})`);
    await browser.setWindowSize(width, height);
  }

  /**
   * Open a sub page of the root page
   * @param path path of the sub page (e.g. /signin)
   */
  public async open(path = '') {
    if (this.isMobilePlatform()) {
      await browser.pause(3000); // Give app time to initialize
      await this.switchToWebviewContext(); // Add this line
      console.log(`Mobile app should navigate to: ${path}`);
      await this.waitForPageLoad();
    } else {
      await browser.url(`${baseURL}${path}`); // Keep your baseURL usage
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
          } catch (error) {
            return false;
          }
        },
        {
          timeout: 15000,
          timeoutMsg: 'Webview content not ready within 15 seconds',
        }
      );

      // Debug: log current page info
      try {
        const url = await browser.getUrl();
        const title = await browser.getTitle();
        const bodyText = await $('body').getText();
        console.log(`Current URL: ${url}`);
        console.log(`Page title: ${title}`);
        console.log(`Body content preview: ${bodyText.substring(0, 200)}...`);

        // Try to find any elements with data-testid
        const testElements = await $$('[data-testid]');
        console.log(`Found ${testElements.length} elements with data-testid`);

        for (let i = 0; i < Math.min(testElements.length, 5); i++) {
          const testId = await testElements[i].getAttribute('data-testid');
          console.log(`  - data-testid="${testId}"`);
        }
      } catch (error) {
        console.log('Debug info failed:', error.message);
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
   * Take a screenshot with environment-configured naming
   */
  public async takeScreenshot(category: string, baseName: string) {
    const {name} = this.getViewportConfig();
    const filename = `${baseName}-${name}`;

    const theme = process.env.VITE_THEME || 'default';
    const dirName = `${SCREENSHOT_DIR}/${theme}/${category}`;
    mkdirSync(dirName, {recursive: true});
    console.log(`Taking screenshot: ${filename}.png`);
    await browser.saveScreenshot(`${dirName}/${filename}.png`);

    return filename;
  }
}
