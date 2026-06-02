import {config as baseConfig} from './wdio.conf.ts';
import {headlessChromeCapabilities} from './chrome-headless-capabilities.ts';

/**
 * Web dashboard e2e (test/specs/web/**) with headless Chrome.
 *
 * Set WEB_URL env var to override the dashboard URL.
 * Set VIEWPORT=desktop|wide (default: desktop) to control the screenshot size.
 */
export const config = {
  ...baseConfig,
  specs: ['./test/specs/web/**/*.ts'],
  baseUrl: process.env.WEB_URL || 'http://localhost:3001',
  // Avoid parallel logins against the same API (token exchange races).
  maxInstances: 1,
  capabilities: [...headlessChromeCapabilities],
};
