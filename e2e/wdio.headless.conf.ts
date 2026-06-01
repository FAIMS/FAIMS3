import {config as baseConfig} from './wdio.conf.ts';
import {headlessChromeCapabilities} from './chrome-headless-capabilities.ts';

/**
 * Same as wdio.conf.ts but runs Chrome headless (no X server / xvfb required).
 */
export const config = {
  ...baseConfig,
  baseUrl: process.env.WEB_URL || 'http://localhost:3001',
  // Avoid parallel logins against the same API (token exchange races).
  maxInstances: 1,
  capabilities: [...headlessChromeCapabilities],
};
