/**
 * Chrome capabilities for CI and headless Linux environments (no DISPLAY / xvfb).
 */
export const headlessChromeCapabilities = [
  {
    browserName: 'chrome',
    // Avoid WDIO v9 BiDi isDisplayed() serialization issues on headless Chrome.
    'wdio:enforceWebDriverClassic': true,
    'goog:chromeOptions': {
      args: [
        '--headless=new',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    },
  },
] as const;
