/* eslint-disable n/no-process-exit */
/**
 * One-off: migrate test JSONL backups from legacy layout (per-project metadata DB +
 * v3 project rows) to projects DB v4 (inlined uiSpecification, no metadataDb).
 *
 * Usage (from api/):
 *   pnpm exec ts-node src/scripts/migrateBackupJsonl.ts test/backup-short.jsonl
 *   pnpm exec ts-node src/scripts/migrateBackupJsonl.ts test/backup.jsonl --replace
 *
 * By default writes `<input>.migrated.jsonl` next to each input file.
 */
import {
  type DatabaseInterface,
  type LegacyEncodedUISpecification,
  type NotebookDefinition,
  ProjectStatus,
  buildSurveyNotebookDefinitionFromLegacy,
  deriveRootDescription,
  migrationTimestamps,
  readLegacyNotebookFromMetadataDb,
} from '@faims3/data-model';
import * as fs from 'fs';
import * as path from 'path';
import {createInterface} from 'readline';
import {finished} from 'stream/promises';

const MIGRATION_CREATED_BY = 'system';

type JsonlRecord = Record<string, unknown>;

type BackupSection = {
  header: JsonlRecord;
  rows: JsonlRecord[];
};

const EMPTY_UI_SPECIFICATION: NotebookDefinition = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../../notebooks/empty_ui_specification.json'),
    'utf-8'
  )
).uiSpecification as NotebookDefinition;

function showHelp(): void {
  console.log(`Migrate legacy test backup JSONL files to projects DB v4 shape.

Options:
  --replace       Overwrite input files (default: write <file>.migrated.jsonl)
  --help, -h      Show this help

Examples:
  pnpm exec ts-node src/scripts/migrateBackupJsonl.ts test/backup-short.jsonl
  pnpm exec ts-node src/scripts/migrateBackupJsonl.ts test/backup.jsonl --replace
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

function projectIdFromMetadataDatabaseName(dbName: string): string | null {
  const marker = '||';
  const idx = dbName.indexOf(marker);
  if (!dbName.startsWith('metadata') || idx < 0) {
    return null;
  }
  const projectId = dbName.slice(idx + marker.length).trim();
  return projectId.length > 0 ? projectId : null;
}

function normalizeProjectStatus(status: unknown): ProjectStatus {
  if (status === ProjectStatus.OPEN) {
    return ProjectStatus.OPEN;
  }
  if (status === ProjectStatus.CLOSED) {
    return ProjectStatus.CLOSED;
  }
  if (status === ProjectStatus.ARCHIVED) {
    return ProjectStatus.ARCHIVED;
  }
  if (
    status === 'published' ||
    status === 'OPEN' ||
    status === undefined ||
    status === null ||
    status === ''
  ) {
    return ProjectStatus.OPEN;
  }
  if (status === 'CLOSED' || status === 'closed') {
    return ProjectStatus.CLOSED;
  }
  if (status === 'ARCHIVED' || status === 'archived') {
    return ProjectStatus.ARCHIVED;
  }
  console.warn(`Unknown project status "${String(status)}"; using OPEN`);
  return ProjectStatus.OPEN;
}

function inMemoryMetadataDb(docs: JsonlRecord[]): DatabaseInterface {
  return {
    allDocs: async (opts?: PouchDB.Core.AllDocsOptions) => ({
      rows: docs.map(doc => ({
        id: String(doc._id),
        key: String(doc._id),
        value: {rev: String(doc._rev ?? '')},
        doc: opts?.include_docs ? doc : undefined,
      })),
    }),
  } as DatabaseInterface;
}

async function legacyNotebookFromSectionRows(
  rows: JsonlRecord[],
  projectId: string
): Promise<{
  legacyMetadata: Record<string, unknown>;
  encodedUiSpec?: LegacyEncodedUISpecification;
}> {
  const couchDocs: JsonlRecord[] = [];
  for (const row of rows) {
    const doc = row.doc;
    if (
      doc != null &&
      typeof doc === 'object' &&
      typeof (doc as JsonlRecord)._id === 'string'
    ) {
      couchDocs.push(doc as JsonlRecord);
    }
  }

  if (couchDocs.length === 0) {
    return {legacyMetadata: {}};
  }

  const {metadata, encodedUiSpec} = await readLegacyNotebookFromMetadataDb(
    inMemoryMetadataDb(couchDocs),
    projectId
  );
  return {legacyMetadata: metadata, encodedUiSpec};
}

function isProjectsDataSection(dbName: string): boolean {
  return (
    dbName.startsWith('projects_') &&
    dbName !== 'projects__design/permissions' &&
    dbName !== 'projects_locallycreatedproject'
  );
}

async function buildV4ProjectDoc(
  projectDoc: JsonlRecord,
  legacyByProjectId: Map<
    string,
    {
      legacyMetadata: Record<string, unknown>;
      encodedUiSpec?: LegacyEncodedUISpecification;
    }
  >
): Promise<JsonlRecord> {
  const projectId = String(projectDoc._id ?? '');
  const legacy = legacyByProjectId.get(projectId);
  const name =
    String(projectDoc.name ?? '').trim() ||
    String(legacy?.legacyMetadata.name ?? '').trim() ||
    projectId;

  const uiSpecification = legacy
    ? buildSurveyNotebookDefinitionFromLegacy({
        legacyMetadata: legacy.legacyMetadata,
        encodedUiSpec: legacy.encodedUiSpec,
      })
    : {
        ...EMPTY_UI_SPECIFICATION,
        metadata: {
          ...EMPTY_UI_SPECIFICATION.metadata,
          information: {
            ...EMPTY_UI_SPECIFICATION.metadata.information,
            purposeMarkdown: '',
          },
        },
      };

  const description = legacy
    ? deriveRootDescription(legacy.legacyMetadata)
    : '';

  const {createdAt, updatedAt} = migrationTimestamps();

  const dataDb = projectDoc.dataDb;
  if (!dataDb || typeof dataDb !== 'object') {
    throw new Error(`Project ${projectId} is missing dataDb`);
  }

  const v4: JsonlRecord = {
    _id: projectDoc._id,
    _rev: projectDoc._rev,
    name,
    description,
    status: normalizeProjectStatus(projectDoc.status),
    dataDb,
    createdBy: MIGRATION_CREATED_BY,
    createdAt,
    updatedAt,
    uiSpecification,
  };

  if (projectDoc.ownedByTeamId !== undefined) {
    v4.ownedByTeamId = projectDoc.ownedByTeamId;
  }
  if (projectDoc.templateId !== undefined) {
    v4.templateId = projectDoc.templateId;
  }

  return v4;
}

async function readSections(filePath: string): Promise<BackupSection[]> {
  const sections: BackupSection[] = [];
  let current: BackupSection | undefined;

  const rl = createInterface({
    input: fs.createReadStream(filePath, {encoding: 'utf-8'}),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) {
      continue;
    }
    const record = JSON.parse(line) as JsonlRecord;
    if (record.type === 'header') {
      if (current) {
        sections.push(current);
      }
      current = {header: record, rows: []};
    } else if (current) {
      current.rows.push(record);
    }
  }

  if (current) {
    sections.push(current);
  }

  return sections;
}

async function writeJsonl(
  filePath: string,
  sections: BackupSection[]
): Promise<void> {
  const stream = fs.createWriteStream(filePath, {encoding: 'utf-8'});
  for (const section of sections) {
    stream.write(`${JSON.stringify(section.header)}\n`);
    for (const row of section.rows) {
      stream.write(`${JSON.stringify(row)}\n`);
    }
  }
  stream.end();
  await finished(stream);
}

async function migrateBackupFileToOutput(
  inputPath: string,
  outputPath: string
): Promise<{
  metadataSectionsDropped: number;
  projectsMigrated: number;
  projectsStubbed: number;
}> {
  const absInput = path.resolve(inputPath);
  const sections = await readSections(absInput);

  const legacyByProjectId = new Map<
    string,
    {
      legacyMetadata: Record<string, unknown>;
      encodedUiSpec?: LegacyEncodedUISpecification;
    }
  >();

  for (const section of sections) {
    const dbName = String(section.header.database ?? '');
    const projectId = projectIdFromMetadataDatabaseName(dbName);
    if (!projectId) {
      continue;
    }
    legacyByProjectId.set(
      projectId,
      await legacyNotebookFromSectionRows(section.rows, projectId)
    );
  }

  let metadataSectionsDropped = 0;
  let projectsMigrated = 0;
  let projectsStubbed = 0;
  const outSections: BackupSection[] = [];

  for (const section of sections) {
    const dbName = String(section.header.database ?? '');

    if (dbName.startsWith('metadata')) {
      metadataSectionsDropped += 1;
      continue;
    }

    if (!isProjectsDataSection(dbName)) {
      outSections.push(section);
      continue;
    }

    const migratedRows: JsonlRecord[] = [];
    for (const row of section.rows) {
      const rowId = String(row.id ?? '');
      if (rowId.startsWith('_design')) {
        migratedRows.push(row);
        continue;
      }

      const projectDoc = row.doc;
      if (!projectDoc || typeof projectDoc !== 'object') {
        migratedRows.push(row);
        continue;
      }

      const projectRow = projectDoc as JsonlRecord;
      const projectId = String(projectRow._id ?? '');
      const hasLegacy = legacyByProjectId.has(projectId);
      const v4Doc = await buildV4ProjectDoc(projectRow, legacyByProjectId);

      if (hasLegacy) {
        projectsMigrated += 1;
      } else {
        projectsStubbed += 1;
        console.warn(
          `  No metadata section for project ${projectId}; wrote empty uiSpecification`
        );
      }

      migratedRows.push({
        ...row,
        doc: v4Doc,
      });
    }

    outSections.push({header: section.header, rows: migratedRows});
  }

  await writeJsonl(outputPath, outSections);

  return {metadataSectionsDropped, projectsMigrated, projectsStubbed};
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
      ? absInput
      : absInput.replace(/\.jsonl$/i, '.migrated.jsonl');

    console.log(`Migrating ${absInput} -> ${outputPath}`);

    const stats = await migrateBackupFileToOutput(absInput, outputPath);

    console.log(
      `  dropped ${stats.metadataSectionsDropped} metadata section(s); ` +
        `migrated ${stats.projectsMigrated} project(s); ` +
        `stubbed ${stats.projectsStubbed} project(s) without metadata`
    );
  }

  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
