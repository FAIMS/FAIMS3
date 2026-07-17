import {config as baseConfig} from './wdio.conf.ts';
import {headlessChromeCapabilities} from './chrome-headless-capabilities.ts';
import {getAppUrl, loadE2eEnv} from './test/helpers/env.ts';
import {beginSuite, junitOutputDir} from './test/helpers/artifacts.ts';

loadE2eEnv();
beginSuite('app');

/**
 * Fieldmark app e2e (test/specs/app/**) with headless Chrome.
 * baseUrl = WEB_APP_PUBLIC_URL (default http://localhost:3000).
 * Suite label: `app`.
 */
export const config = {
  ...baseConfig,
  specs: ['./test/specs/app/**/*.ts'],
  baseUrl: getAppUrl(),
  // Avoid parallel logins against the same API (token exchange races).
  maxInstances: 1,
  // Headless Chrome does not need Xvfb; wrapping it distorts screenshot aspect.
  autoXvfb: false,
  capabilities: [...headlessChromeCapabilities],
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
