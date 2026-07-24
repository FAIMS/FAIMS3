/**
 * Run-scoped artifact directories, JSONL manifest, and summary writers.
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {getArtifactDir, getSuiteSlug, setSuiteSlug} from './env.ts';
import {generateReportsForRun} from './report.ts';
import {readCurrentRunId, writeCurrentRunId} from './run-id.ts';

const e2eRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export type Surface = 'web' | 'app' | 'conductor';

export type ManifestEntry = {
  runId: string;
  timestamp: string;
  surface?: Surface;
  spec?: string;
  test?: string;
  step?: number;
  label: string;
  viewport?: string;
  passed?: boolean;
  path: string;
  url?: string;
  kind?: 'step' | 'docs' | 'failure' | 'result';
  /** Present on failed `result` / `failure` entries when available */
  error?: string;
  durationMs?: number;
};

export type TestResultEntry = {
  runId: string;
  timestamp: string;
  spec: string;
  test: string;
  passed: boolean;
  durationMs?: number;
  error?: string;
  url?: string;
};

type RunContext = {
  runId: string;
  runDir: string;
  jsonlPath: string;
  stepCounter: number;
  suite: string;
  currentSpec?: string;
  currentTest?: string;
};

let ctx: RunContext | null = null;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Run folder id: `{utcStamp}-{suite}-{hex}` e.g. `20260714T053007Z-app-4d403d`.
 */
function makeRunId(): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z');
  const suite = getSuiteSlug();
  const suffix = randomBytes(3).toString('hex');
  return `${stamp}-${suite}-${suffix}`;
}

/**
 * Label this WDIO entry conf (`smoke` | `web` | `app`).
 * Does not mint a run id — workers re-import conf files, so run creation
 * stays in launcher `onPrepare` (see hooks).
 */
export function beginSuite(suite: string): string {
  return setSuiteSlug(suite);
}

/**
 * JUnit output dir under the current artifact run.
 * Does not mint a run id (config load happens before onPrepare / in workers).
 */
export function junitOutputDir(): string {
  const runId = process.env.E2E_RUN_ID || readCurrentRunId();
  if (runId) {
    return join(resolve(e2eRoot, getArtifactDir()), runId, 'junit');
  }
  // Launcher config evaluation before onPrepare — workers always have .current-run.
  return join(
    resolve(e2eRoot, getArtifactDir()),
    `_pending-${getSuiteSlug()}`,
    'junit'
  );
}

/** Remove `_pending-*` dirs left from config evaluation before onPrepare. */
export function cleanupPendingArtifactDirs(): void {
  const artifactRoot = resolve(e2eRoot, getArtifactDir());
  if (!existsSync(artifactRoot)) return;
  for (const name of readdirSync(artifactRoot)) {
    if (!name.startsWith('_pending-')) continue;
    try {
      rmSync(join(artifactRoot, name), {recursive: true, force: true});
    } catch {
      // ignore
    }
  }
}

export function getRunContext(): RunContext {
  if (!ctx) {
    initArtifactRun();
  }
  return ctx!;
}

export function initArtifactRun(
  runId?: string,
  options: {forceNew?: boolean} = {}
): RunContext {
  const id = options.forceNew
    ? runId || makeRunId()
    : runId || readCurrentRunId() || process.env.E2E_RUN_ID || makeRunId();
  writeCurrentRunId(id);
  const artifactRoot = resolve(e2eRoot, getArtifactDir());
  const runDir = join(artifactRoot, id);
  mkdirSync(runDir, {recursive: true});
  mkdirSync(join(runDir, 'downloads'), {recursive: true});
  const jsonlPath = join(runDir, 'manifest.jsonl');
  if (!existsSync(jsonlPath)) {
    writeFileSync(jsonlPath, '');
  }
  ctx = {
    runId: id,
    runDir,
    jsonlPath,
    stepCounter: 0,
    suite: getSuiteSlug(),
  };
  return ctx;
}

export function resetStepCounter(): void {
  const c = getRunContext();
  c.stepCounter = 0;
}

export function nextStepSeq(): number {
  const c = getRunContext();
  c.stepCounter += 1;
  return c.stepCounter;
}

export function setCurrentTest(spec: string, test: string): void {
  const c = getRunContext();
  c.currentSpec = spec;
  c.currentTest = test;
}

export function getCurrentTest(): {spec?: string; test?: string} {
  const c = getRunContext();
  return {spec: c.currentSpec, test: c.currentTest};
}

export function appendManifest(entry: ManifestEntry): void {
  const c = getRunContext();
  appendFileSync(c.jsonlPath, `${JSON.stringify(entry)}\n`);
}

export function testArtifactDir(spec?: string, test?: string): string {
  const c = getRunContext();
  const specSlug = slugify(spec || c.currentSpec || 'unknown-spec');
  const testSlug = slugify(test || c.currentTest || 'unknown-test');
  const dir = join(c.runDir, specSlug, testSlug);
  mkdirSync(dir, {recursive: true});
  return dir;
}

export function failureArtifactDir(spec?: string, test?: string): string {
  const c = getRunContext();
  const specSlug = slugify(spec || c.currentSpec || 'unknown-spec');
  const testSlug = slugify(test || c.currentTest || 'unknown-test');
  const dir = join(c.runDir, 'failures', specSlug, testSlug);
  mkdirSync(dir, {recursive: true});
  return dir;
}

export function relativeToE2e(absPath: string): string {
  return relative(e2eRoot, absPath).replace(/\\/g, '/');
}

export function padSeq(n: number): string {
  return String(n).padStart(3, '0');
}

export {slugify};

/**
 * Finalize JSONL → manifest.json + summary.md + HTML gallery (onComplete).
 */
export function finalizeArtifacts(exitCode: number): void {
  if (!ctx) return;
  const {runDir, jsonlPath, runId, suite} = ctx;
  const lines = existsSync(jsonlPath)
    ? readFileSync(jsonlPath, 'utf8').split('\n').filter(Boolean)
    : [];
  const entries: ManifestEntry[] = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line) as ManifestEntry);
    } catch {
      // skip corrupt lines
    }
  }

  const finishedAt = new Date().toISOString();
  const manifestPath = join(runDir, 'manifest.json');
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        runId,
        suite,
        finishedAt,
        exitCode,
        entryCount: entries.length,
        entries,
      },
      null,
      2
    )
  );

  const results = entries.filter(e => e.kind === 'result');
  const passed = results.filter(e => e.passed).length;
  const failed = results.filter(e => e.passed === false).length;
  const shots = entries.filter(e => e.kind !== 'result');

  const summary = [
    `# E2E run ${runId}`,
    '',
    `- Suite: ${suite}`,
    `- Finished: ${finishedAt}`,
    `- Exit code: ${exitCode}`,
    `- Test results recorded: ${results.length} (passed ${passed}, failed ${failed})`,
    `- Screenshot / artifact entries: ${shots.length}`,
    `- HTML gallery: [index.html](./index.html)`,
    '',
    '## Failures',
    '',
  ];

  const failures = results.filter(e => e.passed === false);
  if (failures.length === 0) {
    summary.push('_None_');
  } else {
    for (const f of failures) {
      summary.push(`- \`${f.spec}\` — ${f.test}`);
    }
  }

  summary.push('', '## Artifacts', '');
  for (const e of shots.slice(0, 50)) {
    summary.push(`- [${e.label}](${e.path}) (${e.kind ?? 'step'})`);
  }
  if (shots.length > 50) {
    summary.push(`- …and ${shots.length - 50} more (see manifest.json)`);
  }
  summary.push('');

  writeFileSync(join(runDir, 'summary.md'), summary.join('\n'));

  try {
    const {runReport, index} = generateReportsForRun(runDir);
    console.log(`[e2e] wrote gallery ${relativeToE2e(runReport)}`);
    console.log(`[e2e] wrote run index ${relativeToE2e(index)}`);
  } catch (err) {
    console.warn('[e2e] failed to write HTML gallery:', err);
  }
}
