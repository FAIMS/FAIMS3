/* eslint-disable n/no-process-exit */
/**
 * Migrate on-disk notebook JSON fixtures to CURRENT_NOTEBOOK_UI_SCHEMA_VERSION.
 *
 * Usage (from api/):
 *   pnpm exec ts-node src/scripts/migrateNotebookJson.ts path/to/file.json [...]
 *
 * Output shape:
 * - Legacy wire (`metadata` + `ui-specification`) or NotebookDefinition root → NotebookDefinition
 * - Project/template loader shape (`name`, `description`, `uiSpecification`) → same wrapper, migrated inner
 */
import {normalizeNotebookUiSpecification} from '@faims3/data-model';
import * as fs from 'fs';
import * as path from 'path';

type ProjectWrapper = {
  name: string;
  description: string;
  uiSpecification: ReturnType<typeof normalizeNotebookUiSpecification>;
};

function isProjectWrapper(raw: Record<string, unknown>): raw is Record<
  string,
  unknown
> & {
  name: string;
  description?: string;
  uiSpecification: unknown;
} {
  return (
    typeof raw.name === 'string' &&
    raw.uiSpecification !== undefined &&
    raw.uiSpecification !== null
  );
}

function isNotebookDefinitionRoot(raw: Record<string, unknown>): boolean {
  return raw.uiSpec !== undefined && raw.metadata !== undefined;
}

function isLegacyWire(raw: Record<string, unknown>): boolean {
  return raw['ui-specification'] !== undefined;
}

/** Some fixtures use decoded `views` while still on schema 1.0; v2 migration expects `fviews`. */
function preprocessHybridLegacyWire(raw: Record<string, unknown>): void {
  const uiSpec = raw['ui-specification'];
  if (!isPlainObject(uiSpec)) {
    return;
  }
  const views = uiSpec.views;
  const fviews = uiSpec.fviews;
  if (isPlainObject(views) && fviews === undefined) {
    uiSpec.fviews = views;
    delete uiSpec.views;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function migrateToNotebookDefinition(
  raw: Record<string, unknown>
): ReturnType<typeof normalizeNotebookUiSpecification> {
  if (isProjectWrapper(raw)) {
    return normalizeNotebookUiSpecification(raw.uiSpecification);
  }
  if (isNotebookDefinitionRoot(raw) || isLegacyWire(raw)) {
    if (isLegacyWire(raw)) {
      preprocessHybridLegacyWire(raw);
    }
    return normalizeNotebookUiSpecification(raw);
  }
  throw new Error(
    'Unrecognised notebook JSON shape (expected legacy wire, NotebookDefinition, or project wrapper)'
  );
}

function migrateFile(
  absPath: string,
  format: 'notebookDefinition' | 'projectWrapper'
): void {
  const raw = JSON.parse(fs.readFileSync(absPath, 'utf-8')) as Record<
    string,
    unknown
  >;
  const migrated = migrateToNotebookDefinition(raw);

  let output: unknown;
  if (format === 'projectWrapper') {
    const name =
      (typeof raw.name === 'string' && raw.name) ||
      (typeof (raw.metadata as {name?: string} | undefined)?.name ===
        'string' &&
        (raw.metadata as {name: string}).name) ||
      'Untitled';
    const description =
      (typeof raw.description === 'string' && raw.description) ||
      (typeof (raw.metadata as {pre_description?: string} | undefined)
        ?.pre_description === 'string' &&
        (raw.metadata as {pre_description: string}).pre_description) ||
      '';
    output = {
      name,
      description,
      uiSpecification: migrated,
    } satisfies ProjectWrapper;
  } else {
    output = migrated;
  }

  fs.writeFileSync(absPath, `${JSON.stringify(output, null, 2)}\n`, 'utf-8');
  console.log('migrated', absPath);
}

function showHelp(): void {
  console.log(`Migrate notebook JSON fixtures to the current schema.

Options:
  --wrapper       Write { name, description, uiSpecification } (api/notebooks loader shape)
  --help, -h      Show this help

Default output is NotebookDefinition at the JSON root ({ uiSpec, metadata }).
`);
}

function parseArgs(argv: string[]): {
  files: string[];
  wrapper: boolean;
  help: boolean;
} {
  const files: string[] = [];
  let wrapper = false;
  let help = false;
  for (const arg of argv) {
    if (arg === '--wrapper') {
      wrapper = true;
    } else if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (!arg.startsWith('-')) {
      files.push(arg);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return {files, wrapper, help};
}

function main(): void {
  const {files, wrapper, help} = parseArgs(process.argv.slice(2));
  if (help) {
    showHelp();
    return;
  }
  if (files.length === 0) {
    showHelp();
    process.exit(1);
  }
  const format = wrapper ? 'projectWrapper' : 'notebookDefinition';
  for (const file of files) {
    const abs = path.isAbsolute(file)
      ? file
      : path.resolve(process.cwd(), file);
    migrateFile(abs, format);
  }
}

main();
