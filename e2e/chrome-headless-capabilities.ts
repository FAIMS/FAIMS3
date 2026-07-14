import {
  getViewportConfig,
  chromeViewportArgs,
} from './test/helpers/viewport.ts';

/**
 * Chrome capabilities for CI and headless Linux environments (no DISPLAY / xvfb).
 *
 * --window-size + --force-device-scale-factor=1 keep screenshot pixels square
 * (avoids horizontally stretched docs shots under headless Chrome).
 *
 * Optional env (GitHub Actions / pinned Chrome):
 * - CHROME_BIN — path to Chrome/Chromium binary
 * - CHROMEDRIVER_PATH — path to matching chromedriver (also accepts CHROMEWEBDRIVER)
 */
const viewport = getViewportConfig();

const chromeBinary = process.env.CHROME_BIN || process.env.WDIO_CHROME_PATH;
const chromeDriver =
  process.env.CHROMEDRIVER_PATH ||
  process.env.CHROMEWEBDRIVER ||
  process.env.WDIO_CHROME_DRIVER;

export const headlessChromeCapabilities = [
  {
    browserName: 'chrome',
    // Avoid WDIO v9 BiDi isDisplayed() serialization issues on headless Chrome.
    'wdio:enforceWebDriverClassic': true,
    ...(chromeDriver
      ? {
          'wdio:chromedriverOptions': {
            binary: chromeDriver,
          },
        }
      : {}),
    'goog:chromeOptions': {
      ...(chromeBinary ? {binary: chromeBinary} : {}),
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
