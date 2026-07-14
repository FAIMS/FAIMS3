import {config as baseConfig} from './wdio.conf.ts';
import {headlessChromeCapabilities} from './chrome-headless-capabilities.ts';
import {getWebUrl, loadE2eEnv} from './test/helpers/env.ts';

loadE2eEnv();

/**
 * Web dashboard e2e (test/specs/web/**) with headless Chrome.
 */
export const config = {
  ...baseConfig,
  specs: ['./test/specs/web/**/*.ts', './test/specs/journeys/**/*.ts'],
  baseUrl: getWebUrl(),
  maxInstances: 1,
  autoXvfb: false,
  capabilities: [...headlessChromeCapabilities],
};
