/**
 * Shared WebdriverIO hooks for artifact + screenshot pipeline.
 */
import type {Frameworks} from '@wdio/types';
import {loadE2eEnv} from './env.ts';
import {
  appendManifest,
  cleanupPendingArtifactDirs,
  finalizeArtifacts,
  getRunContext,
  initArtifactRun,
  resetStepCounter,
  setCurrentTest,
} from './artifacts.ts';
import {captureFailure} from './screenshot.ts';
import {applyViewport} from './viewport.ts';

function specFromPath(specPath: string): string {
  const normalized = specPath.replace(/\\/g, '/');
  const idx = normalized.indexOf('test/specs/');
  return idx >= 0 ? normalized.slice(idx + 'test/specs/'.length) : normalized;
}

export function createE2eHooks() {
  return {
    onPrepare() {
      loadE2eEnv();
      cleanupPendingArtifactDirs();
      // Fresh suite-labelled run per WDIO invocation (smoke / web / app).
      initArtifactRun(undefined, {forceNew: true});
      const {runId, suite} = getRunContext();
      console.log(`[e2e] artifact run ${runId} (suite=${suite})`);
    },

    beforeSession() {
      loadE2eEnv();
      // Workers share run id via artifacts/.current-run (written in onPrepare)
      initArtifactRun();
    },

    async before() {
      loadE2eEnv();
      // Apply once per session so shots are 1:1 CSS pixels even before Page.open
      if (
        !browser.isMobile &&
        process.env.PLATFORM !== 'android' &&
        process.env.PLATFORM !== 'ios'
      ) {
        await applyViewport();
      }
    },

    beforeTest(test: Frameworks.Test) {
      resetStepCounter();
      const spec = specFromPath(test.file || 'unknown');
      setCurrentTest(spec, test.title);
    },

    async afterTest(
      test: Frameworks.Test,
      _context: unknown,
      result: Frameworks.TestResult
    ) {
      const spec = specFromPath(test.file || 'unknown');
      const {passed, error, duration} = result;

      if (!passed) {
        await captureFailure({
          spec,
          test: test.title,
          error: error?.message,
        });
      }

      let url: string | undefined;
      try {
        url = await browser.getUrl();
      } catch {
        // ignore
      }

      appendManifest({
        runId: getRunContext().runId,
        timestamp: new Date().toISOString(),
        spec,
        test: test.title,
        label: passed ? 'pass' : 'fail',
        passed,
        path: '',
        url,
        kind: 'result',
        error: passed ? undefined : error?.message,
        durationMs: typeof duration === 'number' ? duration : undefined,
      });
    },

    onComplete(exitCode: number) {
      finalizeArtifacts(exitCode);
      const {runId, runDir} = getRunContext();
      console.log(
        `[e2e] wrote artifacts for run ${runId} (exit ${exitCode}) → ${runDir}/index.html`
      );
    },
  };
}
