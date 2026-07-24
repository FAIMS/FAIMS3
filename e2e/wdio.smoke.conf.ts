import {config as baseConfig} from './wdio.conf.ts';
import {getAppUrl, loadE2eEnv} from './test/helpers/env.ts';
import {beginSuite, junitOutputDir} from './test/helpers/artifacts.ts';

loadE2eEnv();
beginSuite('smoke');

/**
 * Tier 0 smoke suite (test/specs/smoke/**).
 * Uses app baseUrl by default; individual specs navigate absolutely as needed.
 */
export const config = {
  ...baseConfig,
  specs: ['./test/specs/smoke/**/*.ts'],
  baseUrl: getAppUrl(),
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
