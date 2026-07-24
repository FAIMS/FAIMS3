import {config as baseConfig} from './wdio.conf.ts';
import {getWebUrl, loadE2eEnv} from './test/helpers/env.ts';
import {beginSuite, junitOutputDir} from './test/helpers/artifacts.ts';

loadE2eEnv();
beginSuite('web');

/**
 * WebdriverIO configuration for the web management dashboard (web/).
 *
 * specs: test/specs/web/** + journeys + conductor
 * baseUrl: WEB_URL / NEW_CONDUCTOR_URL (default http://localhost:3001)
 *
 * Suite label is `web` (includes Control Centre, journeys, and Conductor auth).
 *
 * Set WEB_URL env var to override the dashboard URL.
 * Set VIEWPORT=desktop|wide (default: desktop) to control the screenshot size.
 */
export const config = {
  ...baseConfig,
  specs: [
    './test/specs/web/**/*.ts',
    './test/specs/journeys/**/*.ts',
    './test/specs/conductor/**/*.ts',
  ],
  baseUrl: getWebUrl(),
  // Avoid parallel logins against the same API (token exchange races).
  maxInstances: 1,
  reporters: [
    'spec',
    [
      'junit',
      {
        outputDir: junitOutputDir(),
        outputFileFormat(options: {cid: string}) {
          return `results-${options.cid}.xml`;
        },
      },
    ],
  ],
};
