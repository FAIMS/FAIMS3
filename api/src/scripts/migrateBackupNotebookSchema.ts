// SPDX-License-Identifier: Apache-2.0
/* eslint-disable n/no-process-exit */
/**
 * Migrate inlined `uiSpecification` bundles in test JSONL backups to
 * CURRENT_NOTEBOOK_UI_SCHEMA_VERSION.
 *
 * Unlike `migrateBackupJsonl.ts` (legacy metadata-DB → projects v4 layout),
 * this leaves section structure alone and only rewrites project documents
 * that already carry a `uiSpecification`.
 *
 * Usage (from api/):
 *   pnpm exec tsx src/scripts/migrateBackupNotebookSchema.ts test/backup.jsonl
 *   pnpm exec tsx src/scripts/migrateBackupNotebookSchema.ts --replace \
 *     test/backup.jsonl test/backup-short.jsonl
 */
import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  getNotebookSchemaVersion,
  normalizeNotebookUiSpecification,
  type NotebookWithSchemaVersion,
} from '@faims3/data-model';
import * as fs from 'fs';
import * as path from 'path';
import {createInterface} from 'readline';
import {finished} from 'stream/promises';

type JsonlRecord = Record<string, unknown>;

function showHelp(): void {
  console.log(`Migrate notebook uiSpecification in test JSONL backups.

Options:
  --replace       Overwrite input files (default: write <file>.migrated.jsonl)
  --help, -h      Show this help
`);
}

function parseArgs(argv: string[]): {
  inputs: string[];
  replace: boolean;
  help: boolean;
} {
  const inputs: string[] = [];
  let replace = false;
  let help = false;

  for (const arg of argv) {
    if (arg === '--replace') {
      replace = true;
    } else if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (!arg.startsWith('-')) {
      inputs.push(arg);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return {inputs, replace, help};
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function migrateProjectDoc(doc: JsonlRecord): {
  doc: JsonlRecord;
  from?: string;
  migrated: boolean;
} {
  const raw = doc.uiSpecification;
  if (!isPlainObject(raw)) {
    return {doc, migrated: false};
  }

  const from = getNotebookSchemaVersion(raw as NotebookWithSchemaVersion);
  const uiSpecification = normalizeNotebookUiSpecification(raw);
  return {
    doc: {...doc, uiSpecification},
    from,
    migrated: true,
  };
}

async function migrateBackupFile(
  inputPath: string,
  outputPath: string
): Promise<{migrated: number; skipped: number}> {
  const rl = createInterface({
    input: fs.createReadStream(inputPath, {encoding: 'utf-8'}),
    crlfDelay: Infinity,
  });
  const stream = fs.createWriteStream(outputPath, {encoding: 'utf-8'});

  let migrated = 0;
  let skipped = 0;

  for await (const line of rl) {
    if (!line.trim()) {
      continue;
    }
    const record = JSON.parse(line) as JsonlRecord;
    const doc = record.doc;
    if (
      record.type !== 'header' &&
      isPlainObject(doc) &&
      'uiSpecification' in doc
    ) {
      const projectId = String(doc._id ?? record.id ?? '?');
      const result = migrateProjectDoc(doc);
      if (result.migrated) {
        record.doc = result.doc;
        migrated += 1;
        console.log(
          `  ${projectId}: ${result.from ?? 'none'} → ${CURRENT_NOTEBOOK_UI_SCHEMA_VERSION}`
        );
      } else {
        skipped += 1;
      }
    }
    stream.write(`${JSON.stringify(record)}\n`);
  }

  stream.end();
  await finished(stream);
  return {migrated, skipped};
}

async function main(): Promise<void> {
  const {inputs, replace, help} = parseArgs(process.argv.slice(2));
  if (help) {
    showHelp();
    process.exit(0);
  }

  const files =
    inputs.length > 0
      ? inputs
      : ['test/backup-short.jsonl', 'test/backup.jsonl'];

  for (const input of files) {
    const absInput = path.resolve(input);
    if (!fs.existsSync(absInput)) {
      throw new Error(`Input file not found: ${absInput}`);
    }
    const outputPath = replace
      ? `${absInput}.tmp`
      : absInput.replace(/\.jsonl$/i, '.migrated.jsonl');

    console.log(`Migrating ${absInput} -> ${replace ? absInput : outputPath}`);
    const stats = await migrateBackupFile(absInput, outputPath);
    if (replace) {
      fs.renameSync(outputPath, absInput);
    }
    console.log(
      `  migrated ${stats.migrated} project(s); skipped ${stats.skipped}`
    );
  }

  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
