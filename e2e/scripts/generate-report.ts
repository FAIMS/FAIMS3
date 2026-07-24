#!/usr/bin/env node
/**
 * Regenerate HTML galleries from existing manifest.json files.
 *
 * Usage (from e2e/):
 *   pnpm report
 *   pnpm report -- 20260714T042345Z-f17a6d
 *   pnpm report -- /absolute/path/to/artifacts/<runId>
 */
import {existsSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  generateReportsForRun,
  regenerateAllReports,
} from '../test/helpers/report.ts';

const e2eRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifactRoot = resolve(
  e2eRoot,
  process.env.ARTIFACT_DIR || './artifacts'
);

const arg = process.argv[2];

if (!arg) {
  const written = regenerateAllReports(artifactRoot);
  console.log(
    `Regenerated ${written.length} report file(s) under ${artifactRoot}`
  );
  for (const p of written) console.log(`  ${p}`);
  process.exit(0);
}

const runDir = existsSync(arg) ? resolve(arg) : resolve(artifactRoot, arg);

if (!existsSync(join(runDir, 'manifest.json'))) {
  console.error(`No manifest.json in ${runDir}`);
  process.exit(1);
}

const {runReport, index} = generateReportsForRun(runDir);
console.log(`Wrote ${runReport}`);
console.log(`Wrote ${index}`);
