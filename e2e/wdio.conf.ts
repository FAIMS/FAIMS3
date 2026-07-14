import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createE2eHooks} from './test/helpers/hooks.ts';
import {
  loadE2eEnv,
  getArtifactDir,
  getAppUrl,
  getWdioLogLevel,
} from './test/helpers/env.ts';
import {initArtifactRun, getRunContext} from './test/helpers/artifacts.ts';
import {chromeViewportArgs} from './test/helpers/viewport.ts';

loadE2eEnv();

const e2eRoot = dirname(fileURLToPath(import.meta.url));
const hooks = createE2eHooks();

function junitOutputDir(): string {
  // Ensure run context exists so reporter path is stable for this process
  try {
    initArtifactRun();
  } catch {
    // ignore
  }
  const runId = process.env.E2E_RUN_ID || 'unknown';
  return join(resolve(e2eRoot, getArtifactDir()), runId, 'junit');
}

/**
 * Base WDIO config. App/web/smoke conf files override specs + baseUrl.
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
