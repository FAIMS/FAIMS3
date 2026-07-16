/**
 * Screenshot capture for docs, step artifacts, and failure dumps.
 */
import {browser} from '@wdio/globals';
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  getScreenshotDir,
  getScreenshotMode,
  getTheme,
  type ScreenshotMode,
} from './env.ts';
import {
  appendManifest,
  failureArtifactDir,
  getCurrentTest,
  getRunContext,
  nextStepSeq,
  padSeq,
  relativeToE2e,
  slugify,
  testArtifactDir,
  type Surface,
} from './artifacts.ts';

const e2eRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function modeAllows(
  mode: ScreenshotMode,
  kind: 'docs' | 'artifacts' | 'failure'
): boolean {
  if (mode === 'off') return false;
  if (mode === 'all' || mode === 'on') return true;
  if (mode === 'docs') return kind === 'docs' || kind === 'failure';
  if (mode === 'artifacts') return kind === 'artifacts' || kind === 'failure';
  return true;
}

export function getViewportName(): string {
  return process.env.VIEWPORT || 'desktop';
}

export type CaptureStepOptions = {
  surface: Surface;
  label: string;
  step?: number;
};

/**
 * Capture a named step screenshot under artifacts/<runId>/<spec>/<test>/.
 */
export async function captureStep(
  options: CaptureStepOptions
): Promise<string | null> {
  const mode = getScreenshotMode();
  if (!modeAllows(mode, 'artifacts')) return null;

  const seq = options.step ?? nextStepSeq();
  const labelSlug = slugify(options.label);
  const dir = testArtifactDir();
  const filename = `${padSeq(seq)}-${labelSlug}.png`;
  const absPath = join(dir, filename);
  await browser.saveScreenshot(absPath);

  const {spec, test} = getCurrentTest();
  let url: string | undefined;
  try {
    url = await browser.getUrl();
  } catch {
    // session may be gone
  }

  appendManifest({
    runId: getRunContext().runId,
    timestamp: new Date().toISOString(),
    surface: options.surface,
    spec,
    test,
    step: seq,
    label: options.label,
    viewport: getViewportName(),
    passed: true,
    path: relativeToE2e(absPath),
    url,
    kind: 'step',
  });

  return absPath;
}

export type CaptureDocsOptions = {
  category: string;
  baseName: string;
};

/**
 * Docs-oriented screenshot (compat with Page.takeScreenshot).
 * Layout: {SCREENSHOT_DIR}/{theme}/{category}/{base}-{viewport}.png
 */
export async function captureDocs(
  options: CaptureDocsOptions
): Promise<string | null> {
  const mode = getScreenshotMode();
  if (!modeAllows(mode, 'docs')) return null;

  const viewport = getViewportName();
  const theme = getTheme();
  const filename = `${options.baseName}-${viewport}`;
  const dir = resolve(e2eRoot, getScreenshotDir(), theme, options.category);
  mkdirSync(dir, {recursive: true});
  const absPath = join(dir, `${filename}.png`);
  await browser.saveScreenshot(absPath);

  const {spec, test} = getCurrentTest();
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
    test,
    label: options.baseName,
    viewport,
    path: relativeToE2e(absPath),
    url,
    kind: 'docs',
  });

  return absPath;
}

/**
 * Low-level capture to an absolute or e2e-relative path.
 */
export async function captureRaw(relativePath: string): Promise<string> {
  const absPath = relativePath.startsWith('/')
    ? relativePath
    : resolve(e2eRoot, relativePath);
  mkdirSync(dirname(absPath), {recursive: true});
  await browser.saveScreenshot(absPath);
  return absPath;
}

/**
 * On test failure: full-page screenshot + page.html + meta.json.
 */
export async function captureFailure(options: {
  spec: string;
  test: string;
  error?: string;
}): Promise<void> {
  const mode = getScreenshotMode();
  if (!modeAllows(mode, 'failure')) return;

  const dir = failureArtifactDir(options.spec, options.test);
  const shotPath = join(dir, 'failure.png');
  const htmlPath = join(dir, 'page.html');
  const metaPath = join(dir, 'meta.json');

  let url = '';
  let title = '';
  try {
    url = await browser.getUrl();
    title = await browser.getTitle();
  } catch {
    // ignore
  }

  try {
    await browser.saveScreenshot(shotPath);
  } catch (err) {
    console.warn('Failed to save failure screenshot:', err);
  }

  try {
    const html = await browser.getPageSource();
    writeFileSync(htmlPath, html);
  } catch (err) {
    console.warn('Failed to save page.html:', err);
  }

  const meta = {
    timestamp: new Date().toISOString(),
    url,
    title,
    viewport: getViewportName(),
    windowSize: process.env.VIEWPORT || 'desktop',
    error: options.error,
    spec: options.spec,
    test: options.test,
  };
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));

  appendManifest({
    runId: getRunContext().runId,
    timestamp: meta.timestamp,
    spec: options.spec,
    test: options.test,
    label: 'failure',
    viewport: getViewportName(),
    passed: false,
    path: relativeToE2e(shotPath),
    url,
    kind: 'failure',
    error: options.error,
  });
}
