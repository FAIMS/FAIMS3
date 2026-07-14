/**
 * Run-scoped artifact directories, JSONL manifest, and summary writers.
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {getArtifactDir} from './env.ts';
import {readCurrentRunId, writeCurrentRunId} from './run-id.ts';

const e2eRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export type Surface = 'web' | 'app' | 'conductor';

export type ManifestEntry = {
  runId: string;
  timestamp: string;
  surface?: Surface;
  spec?: string;
  test?: string;
  workflowId?: string;
  step?: number;
  label: string;
  viewport?: string;
  passed?: boolean;
  path: string;
  url?: string;
  kind?: 'step' | 'docs' | 'failure' | 'result';
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

function makeRunId(): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z');
  const suffix = randomBytes(3).toString('hex');
  return `${stamp}-${suffix}`;
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
 * Finalize JSONL → manifest.json + summary.md (onComplete).
 */
export function finalizeArtifacts(exitCode: number): void {
  if (!ctx) return;
  const {runDir, jsonlPath, runId} = ctx;
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

  const manifestPath = join(runDir, 'manifest.json');
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        runId,
        finishedAt: new Date().toISOString(),
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
    `- Finished: ${new Date().toISOString()}`,
    `- Exit code: ${exitCode}`,
    `- Test results recorded: ${results.length} (passed ${passed}, failed ${failed})`,
    `- Screenshot / artifact entries: ${shots.length}`,
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
}
