/**
 * Persist run id so WDIO worker processes share the same artifact folder.
 */
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {getArtifactDir} from './env.ts';

const e2eRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export function currentRunFile(): string {
  return join(resolve(e2eRoot, getArtifactDir()), '.current-run');
}

export function writeCurrentRunId(runId: string): void {
  const file = currentRunFile();
  mkdirSync(dirname(file), {recursive: true});
  writeFileSync(file, runId);
  process.env.E2E_RUN_ID = runId;
}

export function readCurrentRunId(): string | undefined {
  if (process.env.E2E_RUN_ID) return process.env.E2E_RUN_ID;
  const file = currentRunFile();
  if (existsSync(file)) {
    const id = readFileSync(file, 'utf8').trim();
    if (id) {
      process.env.E2E_RUN_ID = id;
      return id;
    }
  }
  return undefined;
}
