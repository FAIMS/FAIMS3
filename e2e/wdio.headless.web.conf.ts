import {config as baseConfig} from './wdio.conf.ts';
import {headlessChromeCapabilities} from './chrome-headless-capabilities.ts';
import {getWebUrl, loadE2eEnv} from './test/helpers/env.ts';
import {beginSuite, junitOutputDir} from './test/helpers/artifacts.ts';

loadE2eEnv();
beginSuite('web');

/**
 * Web dashboard e2e (web + journeys + conductor) with headless Chrome.
 * Suite label: `web`.
 */
export const config = {
  ...baseConfig,
  specs: [
    './test/specs/web/**/*.ts',
    './test/specs/journeys/**/*.ts',
    './test/specs/conductor/**/*.ts',
  ],
  baseUrl: getWebUrl(),
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
