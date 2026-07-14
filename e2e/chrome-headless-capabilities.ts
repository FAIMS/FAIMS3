import {
  getViewportConfig,
  chromeViewportArgs,
} from './test/helpers/viewport.ts';

/**
 * Chrome capabilities for CI and headless Linux environments (no DISPLAY / xvfb).
 *
 * --window-size + --force-device-scale-factor=1 keep screenshot pixels square
 * (avoids horizontally stretched docs shots under headless Chrome).
 */
const viewport = getViewportConfig();

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
        ...chromeViewportArgs(viewport),
      ],
    },
  },
] as const;
