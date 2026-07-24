import {config as baseConfig} from './wdio.conf.ts';
import {headlessChromeCapabilities} from './chrome-headless-capabilities.ts';
import {getAppUrl, loadE2eEnv} from './test/helpers/env.ts';
import {beginSuite, junitOutputDir} from './test/helpers/artifacts.ts';

loadE2eEnv();
beginSuite('smoke');

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
