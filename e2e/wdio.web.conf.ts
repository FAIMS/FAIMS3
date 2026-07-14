import {config as baseConfig} from './wdio.conf.ts';
import {getWebUrl, loadE2eEnv} from './test/helpers/env.ts';

loadE2eEnv();

/**
 * WebdriverIO configuration for the web management dashboard (web/).
 *
 * specs: test/specs/web/**
 * baseUrl: WEB_URL / NEW_CONDUCTOR_URL (default http://localhost:3001)
 */
export const config = {
  ...baseConfig,
  specs: ['./test/specs/web/**/*.ts', './test/specs/journeys/**/*.ts'],
  baseUrl: getWebUrl(),
};
