/**
 * Static HTML gallery / failure report from a run's manifest.json.
 * Output is self-contained relative links so GH Actions zip "just works".
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import {basename, dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {ManifestEntry} from './artifacts.ts';

const e2eRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export type ManifestFile = {
  runId: string;
  suite?: string;
  finishedAt?: string;
  exitCode?: number;
  entryCount?: number;
  entries: ManifestEntry[];
};

type FailureMeta = {
  error?: string;
  url?: string;
  title?: string;
};

type TestGroup = {
  spec: string;
  test: string;
  surface?: string;
  passed?: boolean;
  result?: ManifestEntry;
  steps: ManifestEntry[];
  failure?: ManifestEntry;
  failureMeta?: FailureMeta;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hrefFromRun(runDir: string, manifestPath: string): string {
  if (!manifestPath) return '';
  const abs = resolve(e2eRoot, manifestPath);
  return relative(runDir, abs).replace(/\\/g, '/');
}

function siblingHref(shotHref: string, filename: string): string {
  if (!shotHref) return '';
  const dir = shotHref.includes('/')
    ? shotHref.slice(0, shotHref.lastIndexOf('/'))
    : '.';
  return `${dir}/${filename}`;
}

function readFailureMeta(runDir: string, failurePath: string): FailureMeta {
  const href = hrefFromRun(runDir, failurePath);
  const metaHref = siblingHref(href, 'meta.json');
  if (!metaHref) return {};
  const abs = resolve(runDir, metaHref);
  if (!existsSync(abs)) return {};
  try {
    return JSON.parse(readFileSync(abs, 'utf8')) as FailureMeta;
  } catch {
    return {};
  }
}

function groupTests(runDir: string, entries: ManifestEntry[]): TestGroup[] {
  const map = new Map<string, TestGroup>();

  const keyOf = (spec?: string, test?: string) =>
    `${spec || 'unknown'}::${test || 'unknown'}`;

  for (const e of entries) {
    if (e.kind === 'docs') continue;
    const key = keyOf(e.spec, e.test);
    let g = map.get(key);
    if (!g) {
      g = {
        spec: e.spec || 'unknown',
        test: e.test || 'unknown',
        steps: [],
      };
      map.set(key, g);
    }
    if (e.surface) g.surface = e.surface;

    if (e.kind === 'result') {
      g.result = e;
      g.passed = e.passed;
    } else if (e.kind === 'failure') {
      g.failure = e;
      g.passed = false;
      g.failureMeta = readFailureMeta(runDir, e.path);
    } else if (e.kind === 'step' || !e.kind) {
      g.steps.push(e);
      if (e.surface) g.surface = e.surface;
    }
  }

  const groups = [...map.values()];
  groups.sort((a, b) => {
    const ap = a.passed === false ? 0 : 1;
    const bp = b.passed === false ? 0 : 1;
    if (ap !== bp) return ap - bp;
    const specCmp = a.spec.localeCompare(b.spec);
    if (specCmp !== 0) return specCmp;
    return a.test.localeCompare(b.test);
  });
  for (const g of groups) {
    g.steps.sort(
      (a, b) =>
        (a.step ?? 0) - (b.step ?? 0) || a.timestamp.localeCompare(b.timestamp)
    );
  }
  return groups;
}

function renderFailureCard(runDir: string, g: TestGroup): string {
  const err =
    g.result?.error || g.failureMeta?.error || '(no error message recorded)';
  const url = g.result?.url || g.failureMeta?.url || g.failure?.url || '';
  const shotHref = g.failure?.path ? hrefFromRun(runDir, g.failure.path) : '';
  const pageHref = shotHref ? siblingHref(shotHref, 'page.html') : '';
  const metaHref = shotHref ? siblingHref(shotHref, 'meta.json') : '';
  const surface = g.surface
    ? `<span class="pill">${escapeHtml(g.surface)}</span>`
    : '';

  return `<article class="fail-card" id="${escapeHtml(slugAnchor(g.spec, g.test))}">
  <header>
    ${surface}
    <h3><code>${escapeHtml(g.spec)}</code></h3>
    <p class="test-title">${escapeHtml(g.test)}</p>
  </header>
  <pre class="error">${escapeHtml(err)}</pre>
  ${url ? `<p class="url"><a href="${escapeHtml(url)}" rel="noreferrer">${escapeHtml(url)}</a></p>` : ''}
  <div class="fail-media">
    ${
      shotHref
        ? `<a class="shot" href="${escapeHtml(shotHref)}" target="_blank" rel="noreferrer">
      <img src="${escapeHtml(shotHref)}" alt="Failure screenshot for ${escapeHtml(g.test)}" loading="lazy" />
    </a>`
        : '<p class="muted">No failure screenshot</p>'
    }
    <div class="fail-links">
      ${pageHref ? `<a href="${escapeHtml(pageHref)}" target="_blank" rel="noreferrer">page.html</a>` : ''}
      ${metaHref ? `<a href="${escapeHtml(metaHref)}" target="_blank" rel="noreferrer">meta.json</a>` : ''}
      ${shotHref ? `<a href="${escapeHtml(shotHref)}" target="_blank" rel="noreferrer">failure.png</a>` : ''}
    </div>
  </div>
</article>`;
}

function renderStepThumb(runDir: string, e: ManifestEntry): string {
  const href = hrefFromRun(runDir, e.path);
  if (!href) return '';
  const step = e.step != null ? String(e.step).padStart(3, '0') : '—';
  return `<a class="thumb" href="${escapeHtml(href)}" target="_blank" rel="noreferrer" title="${escapeHtml(e.label)}">
  <img src="${escapeHtml(href)}" alt="${escapeHtml(e.label)}" loading="lazy" />
  <span class="thumb-meta"><span class="seq">${escapeHtml(step)}</span> ${escapeHtml(e.label)}</span>
</a>`;
}

function renderTestSection(runDir: string, g: TestGroup): string {
  const status =
    g.passed === false ? 'failed' : g.passed === true ? 'passed' : 'unknown';
  const surface = g.surface
    ? `<span class="pill surface">${escapeHtml(g.surface)}</span>`
    : '';
  const thumbs = g.steps.map(s => renderStepThumb(runDir, s)).join('\n');
  return `<section class="test-block status-${status}" data-surface="${escapeHtml(g.surface || '')}" data-status="${status}">
  <header>
    <span class="badge ${status}">${status}</span>
    ${surface}
    <h3><code>${escapeHtml(g.spec)}</code></h3>
    <p class="test-title">${escapeHtml(g.test)}</p>
  </header>
  ${
    thumbs
      ? `<div class="thumbs">${thumbs}</div>`
      : '<p class="muted">No step screenshots</p>'
  }
</section>`;
}

function slugAnchor(spec: string, test: string): string {
  return `fail-${spec}-${test}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

/** Parse suite from `{stamp}-{suite}-{hex}` run ids when manifest.suite is missing. */
function suiteFromRunId(runId: string): string | undefined {
  const parts = runId.split('-');
  // stamp has no dashes → exactly 3 segments for labelled runs
  if (parts.length === 3 && /^[a-z][a-z0-9]*$/.test(parts[1])) {
    return parts[1];
  }
  return undefined;
}

function buildRunHtml(manifest: ManifestFile, runDir: string): string {
  const groups = groupTests(runDir, manifest.entries || []);
  const results = (manifest.entries || []).filter(e => e.kind === 'result');
  const passed = results.filter(e => e.passed).length;
  const failed = results.filter(e => e.passed === false).length;
  const shots = (manifest.entries || []).filter(
    e => e.kind === 'step' || e.kind === 'failure' || e.kind === 'docs'
  ).length;
  const failures = groups.filter(g => g.passed === false);
  const exit = manifest.exitCode ?? 0;
  const overall = failed > 0 || exit !== 0 ? 'failed' : 'passed';
  const suiteLabel = manifest.suite || suiteFromRunId(manifest.runId) || 'e2e';

  const surfaces = [
    ...new Set(groups.map(g => g.surface).filter(Boolean) as string[]),
  ].sort();

  const filterButtons = [
    '<button type="button" class="filter active" data-filter="all">All</button>',
    ...surfaces.map(
      s =>
        `<button type="button" class="filter" data-filter="${escapeHtml(s)}">${escapeHtml(s)}</button>`
    ),
    '<button type="button" class="filter" data-filter="failed">Failed only</button>',
  ].join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>E2E ${escapeHtml(suiteLabel)} · ${escapeHtml(manifest.runId)}</title>
<style>
:root {
  --bg: #f6f4ef;
  --panel: #fffdf8;
  --ink: #1c1917;
  --muted: #78716c;
  --line: #e7e5e4;
  --pass: #166534;
  --pass-bg: #dcfce7;
  --fail: #991b1b;
  --fail-bg: #fee2e2;
  --accent: #0f766e;
  --shadow: 0 1px 2px rgb(0 0 0 / 6%);
  font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  color: var(--ink);
  background:
    radial-gradient(1200px 500px at 10% -10%, #d9f3ef 0%, transparent 55%),
    radial-gradient(900px 400px at 100% 0%, #f3e8d8 0%, transparent 50%),
    var(--bg);
  line-height: 1.45;
}
a { color: var(--accent); }
main { max-width: 1100px; margin: 0 auto; padding: 1.5rem 1.25rem 3rem; }
.summary {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 1.25rem 1.35rem;
  box-shadow: var(--shadow);
}
.summary.failed { border-color: #fecaca; }
.summary.passed { border-color: #bbf7d0; }
.summary h1 { margin: 0 0 0.35rem; font-size: 1.35rem; letter-spacing: -0.02em; }
.meta { color: var(--muted); font-size: 0.92rem; margin: 0.25rem 0 0.9rem; }
.stats { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.stat {
  border-radius: 999px;
  padding: 0.25rem 0.75rem;
  font-size: 0.85rem;
  font-weight: 600;
  background: #f5f5f4;
  border: 1px solid var(--line);
}
.stat.pass { background: var(--pass-bg); color: var(--pass); border-color: #86efac; }
.stat.fail { background: var(--fail-bg); color: var(--fail); border-color: #fca5a5; }
h2 { margin: 2rem 0 0.75rem; font-size: 1.1rem; }
.fail-card, .test-block {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 1rem 1.1rem 1.15rem;
  margin: 0.75rem 0;
  box-shadow: var(--shadow);
}
.fail-card { border-color: #fecaca; background: #fff7f7; }
.fail-card h3, .test-block h3 { margin: 0.35rem 0 0.15rem; font-size: 0.98rem; }
.test-title { margin: 0; font-weight: 600; }
.error {
  white-space: pre-wrap;
  background: #1c1917;
  color: #fecaca;
  border-radius: 8px;
  padding: 0.75rem 0.9rem;
  font-size: 0.8rem;
  overflow-x: auto;
}
.url { font-size: 0.85rem; word-break: break-all; }
.fail-media { display: grid; gap: 0.75rem; margin-top: 0.75rem; }
.fail-media img, .thumb img {
  display: block;
  width: 100%;
  max-height: 420px;
  object-fit: contain;
  background: #0c0a09;
  border-radius: 8px;
  border: 1px solid var(--line);
}
.fail-links { display: flex; flex-wrap: wrap; gap: 0.75rem; font-size: 0.9rem; }
.filters { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.5rem 0 1rem; }
.filter {
  border: 1px solid var(--line);
  background: var(--panel);
  border-radius: 999px;
  padding: 0.3rem 0.8rem;
  cursor: pointer;
  font: inherit;
  font-size: 0.85rem;
}
.filter.active { background: #134e4a; color: #ecfdf5; border-color: #134e4a; }
.thumbs {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.65rem;
  margin-top: 0.75rem;
}
.thumb {
  display: block;
  text-decoration: none;
  color: inherit;
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}
.thumb img { max-height: 140px; border: 0; border-radius: 0; }
.thumb-meta {
  display: block;
  padding: 0.4rem 0.5rem;
  font-size: 0.78rem;
  color: var(--muted);
}
.seq { color: var(--ink); font-weight: 700; margin-right: 0.2rem; }
.badge {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  margin-right: 0.35rem;
}
.badge.passed { background: var(--pass-bg); color: var(--pass); }
.badge.failed { background: var(--fail-bg); color: var(--fail); }
.badge.unknown { background: #f5f5f4; color: var(--muted); }
.pill {
  display: inline-block;
  font-size: 0.72rem;
  padding: 0.12rem 0.45rem;
  border-radius: 999px;
  background: #ecfdf5;
  color: #115e59;
  margin-right: 0.3rem;
  vertical-align: middle;
}
.pill.surface { background: #e7e5e4; color: #44403c; }
.muted { color: var(--muted); font-size: 0.9rem; }
.nav { margin: 0 0 1rem; font-size: 0.9rem; }
.test-block.hidden { display: none; }
code { font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 0.88em; }
</style>
</head>
<body>
<main>
  <p class="nav"><a href="../index.html">All runs</a></p>
  <section class="summary ${overall}">
    <h1>E2E <span class="pill surface">${escapeHtml(suiteLabel)}</span> <code>${escapeHtml(manifest.runId)}</code></h1>
    <p class="meta">
      Finished ${escapeHtml(manifest.finishedAt || '—')}
      · exit ${exit}
      · ${results.length} tests
      · ${shots} screenshot entries
    </p>
    <div class="stats">
      <span class="stat pass">${passed} passed</span>
      <span class="stat fail">${failed} failed</span>
      <span class="stat">${shots} shots</span>
    </div>
  </section>

  <h2>Failures</h2>
  ${
    failures.length === 0
      ? '<p class="muted">None</p>'
      : failures.map(g => renderFailureCard(runDir, g)).join('\n')
  }

  <h2>Gallery</h2>
  <div class="filters" id="filters">
    ${filterButtons}
  </div>
  <div id="gallery">
    ${groups.map(g => renderTestSection(runDir, g)).join('\n')}
  </div>
</main>
<script>
(() => {
  const buttons = [...document.querySelectorAll('.filter')];
  const blocks = [...document.querySelectorAll('.test-block')];
  function apply(filter) {
    buttons.forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
    blocks.forEach(block => {
      const surface = block.dataset.surface || '';
      const status = block.dataset.status || '';
      let show = true;
      if (filter === 'failed') show = status === 'failed';
      else if (filter !== 'all') show = surface === filter;
      block.classList.toggle('hidden', !show);
    });
  }
  buttons.forEach(b => b.addEventListener('click', () => apply(b.dataset.filter || 'all')));
})();
</script>
</body>
</html>
`;
}

/**
 * Write artifacts/<runId>/index.html from an existing manifest.json.
 */
export function writeRunReport(runDir: string): string {
  const manifestPath = join(runDir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    throw new Error(`No manifest.json in ${runDir}`);
  }
  const manifest = JSON.parse(
    readFileSync(manifestPath, 'utf8')
  ) as ManifestFile;
  const html = buildRunHtml(manifest, runDir);
  const out = join(runDir, 'index.html');
  writeFileSync(out, html);
  return out;
}

type RunSummary = {
  runId: string;
  suite: string;
  finishedAt?: string;
  exitCode?: number;
  passed: number;
  failed: number;
  shots: number;
  hasReport: boolean;
};

function summarizeRunDir(runDir: string): RunSummary | null {
  const manifestPath = join(runDir, 'manifest.json');
  if (!existsSync(manifestPath)) return null;
  try {
    const manifest = JSON.parse(
      readFileSync(manifestPath, 'utf8')
    ) as ManifestFile;
    const results = (manifest.entries || []).filter(e => e.kind === 'result');
    const shots = (manifest.entries || []).filter(
      e => e.kind === 'step' || e.kind === 'failure' || e.kind === 'docs'
    ).length;
    const runId = manifest.runId || basename(runDir);
    return {
      runId,
      suite: manifest.suite || suiteFromRunId(runId) || '—',
      finishedAt: manifest.finishedAt,
      exitCode: manifest.exitCode,
      passed: results.filter(e => e.passed).length,
      failed: results.filter(e => e.passed === false).length,
      shots,
      hasReport: existsSync(join(runDir, 'index.html')),
    };
  } catch {
    return null;
  }
}

/**
 * Write artifacts/index.html listing all runs (newest first).
 */
export function writeArtifactsIndex(artifactRoot: string): string {
  mkdirSync(artifactRoot, {recursive: true});
  const runs: RunSummary[] = [];
  for (const name of readdirSync(artifactRoot)) {
    if (name.startsWith('.') || name.startsWith('_pending-')) continue;
    const dir = join(artifactRoot, name);
    try {
      const summary = summarizeRunDir(dir);
      if (summary) runs.push(summary);
    } catch {
      // skip
    }
  }
  runs.sort((a, b) => b.runId.localeCompare(a.runId));

  const rows = runs
    .map(r => {
      const overall =
        r.failed > 0 || (r.exitCode ?? 0) !== 0 ? 'failed' : 'passed';
      const href = r.hasReport
        ? `${escapeHtml(r.runId)}/index.html`
        : `${escapeHtml(r.runId)}/summary.md`;
      return `<tr class="${overall}">
  <td><span class="pill">${escapeHtml(r.suite)}</span></td>
  <td><a href="${href}"><code>${escapeHtml(r.runId)}</code></a></td>
  <td>${escapeHtml(r.finishedAt || '—')}</td>
  <td class="num">${r.passed}</td>
  <td class="num">${r.failed}</td>
  <td class="num">${r.shots}</td>
  <td><span class="badge ${overall}">${overall}</span></td>
</tr>`;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>E2E artifact runs</title>
<style>
:root {
  --bg: #f6f4ef;
  --panel: #fffdf8;
  --ink: #1c1917;
  --muted: #78716c;
  --line: #e7e5e4;
  --pass: #166534;
  --pass-bg: #dcfce7;
  --fail: #991b1b;
  --fail-bg: #fee2e2;
  font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
}
body {
  margin: 0;
  color: var(--ink);
  background:
    radial-gradient(1000px 420px at 0% 0%, #d9f3ef 0%, transparent 55%),
    var(--bg);
}
main { max-width: 960px; margin: 0 auto; padding: 1.5rem 1.25rem 3rem; }
h1 { font-size: 1.35rem; letter-spacing: -0.02em; }
.muted { color: var(--muted); }
table {
  width: 100%;
  border-collapse: collapse;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
}
th, td { text-align: left; padding: 0.65rem 0.75rem; border-bottom: 1px solid var(--line); font-size: 0.92rem; }
th { background: #f5f5f4; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
tr.failed { background: #fff7f7; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.badge {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
}
.badge.passed { background: var(--pass-bg); color: var(--pass); }
.badge.failed { background: var(--fail-bg); color: var(--fail); }
.pill {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  background: #e7e5e4;
  color: #44403c;
}
code { font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 0.88em; }
a { color: #0f766e; }
</style>
</head>
<body>
<main>
  <h1>E2E artifact runs</h1>
  <p class="muted">${runs.length} run(s). Suites: smoke, web (Control Centre + conductor + journeys), app.</p>
  <table>
    <thead>
      <tr>
        <th>Suite</th>
        <th>Run</th>
        <th>Finished</th>
        <th class="num">Pass</th>
        <th class="num">Fail</th>
        <th class="num">Shots</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="7" class="muted">No runs with manifest.json yet.</td></tr>'}
    </tbody>
  </table>
</main>
</body>
</html>
`;

  const out = join(artifactRoot, 'index.html');
  writeFileSync(out, html);
  return out;
}

/**
 * Generate per-run report + refresh artifacts/index.html.
 */
export function generateReportsForRun(runDir: string): {
  runReport: string;
  index: string;
} {
  const runReport = writeRunReport(runDir);
  const artifactRoot = dirname(runDir);
  const index = writeArtifactsIndex(artifactRoot);
  return {runReport, index};
}

/**
 * Regenerate reports for every run under the artifact root.
 */
export function regenerateAllReports(artifactRoot: string): string[] {
  const written: string[] = [];
  if (!existsSync(artifactRoot)) return written;
  for (const name of readdirSync(artifactRoot)) {
    if (name.startsWith('.') || name.startsWith('_pending-')) continue;
    const dir = join(artifactRoot, name);
    if (!existsSync(join(dir, 'manifest.json'))) continue;
    written.push(writeRunReport(dir));
  }
  written.push(writeArtifactsIndex(artifactRoot));
  return written;
}
