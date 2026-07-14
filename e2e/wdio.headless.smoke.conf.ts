import {config as baseConfig} from './wdio.conf.ts';
import {headlessChromeCapabilities} from './chrome-headless-capabilities.ts';
import {getAppUrl, loadE2eEnv} from './test/helpers/env.ts';

loadE2eEnv();

/**
 * Tier 0 smoke suite headless (CI gate).
 */
export const config = {
  ...baseConfig,
  specs: ['./test/specs/smoke/**/*.ts'],
  baseUrl: getAppUrl(),
  maxInstances: 1,
  autoXvfb: false,
  capabilities: [...headlessChromeCapabilities],
};
