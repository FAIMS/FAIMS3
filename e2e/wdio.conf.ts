import {createE2eHooks} from './test/helpers/hooks.ts';
import {loadE2eEnv, getAppUrl, getWdioLogLevel} from './test/helpers/env.ts';
import {
  beginSuite,
  getRunContext,
  junitOutputDir,
} from './test/helpers/artifacts.ts';
import {chromeViewportArgs} from './test/helpers/viewport.ts';

loadE2eEnv();

const hooks = createE2eHooks();

/** True when this file is the WDIO entry config (not imported by smoke/web/app confs). */
function isDirectEntry(): boolean {
  return process.argv.some(a => /(?:^|[/\\])wdio\.conf\.ts$/.test(a));
}

if (isDirectEntry()) {
  beginSuite('app');
}

/**
 * Base WDIO config. App/web/smoke conf files override specs + baseUrl + suite.
 */
export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: ['./test/specs/app/**/*.ts'],
  exclude: [],
  maxInstances: 10,
  capabilities: [
    {
      browserName: 'chrome',
      'goog:chromeOptions': {
        args: [...chromeViewportArgs()],
      },
    },
  ],
  logLevel: getWdioLogLevel(),
  bail: 0,
  baseUrl: getAppUrl(),
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  framework: 'mocha',
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
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },
  onPrepare: hooks.onPrepare,
  beforeSession: hooks.beforeSession,
  before: hooks.before,
  beforeTest: hooks.beforeTest,
  afterTest: hooks.afterTest,
  onComplete: hooks.onComplete,
};

// Re-export for conf files that need the run dir after prepare
export {getRunContext};
