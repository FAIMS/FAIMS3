/* eslint-disable n/no-process-exit */
/**
 * Permanently deletes per-project metadata CouchDB databases after uiSpecification
 * has been inlined onto project documents (projects DB v4+).
 *
 * Usage (from api/):
 *   pnpm run delete-metadata-databases
 *   pnpm run delete-metadata-databases -- --dry-run
 */
import * as readline from 'readline';
import {ProjectDocument} from '@faims3/data-model';
import {config} from '../buildconfig';
import {
  destroyCouchDatabase,
  listCouchDatabaseNames,
  verifyCouchDBConnection,
} from '../couchdb';
import {getAllProjectsDirectory} from '../couchdb/notebooks';

/** Default Couch metadata database name prefix (`metadata-{projectId}`). */
const METADATA_DATABASE_NAME_PREFIX = 'metadata-';

export type MetadataDatabaseCandidate = {
  dbName: string;
  /** Parsed from `metadata-{projectId}` when the name follows the default pattern. */
  projectId: string | null;
  projectName?: string;
  /** Project doc still has `metadataDb` / `metadata_db` (pre-cutover or not migrated). */
  stillReferencedOnProject: boolean;
  /** Project doc has inlined `uiSpecification` (projects DB v4+). */
  hasInlinedUiSpecification: boolean;
};

const CONFIRMATION_PHRASE = 'DELETE METADATA DATABASES';

const isMetadataDatabaseName = (dbName: string): boolean =>
  dbName.startsWith(METADATA_DATABASE_NAME_PREFIX);

const projectIdFromMetadataDbName = (dbName: string): string | null => {
  if (!isMetadataDatabaseName(dbName)) {
    return null;
  }
  const id = dbName.slice(METADATA_DATABASE_NAME_PREFIX.length);
  return id.length > 0 ? id : null;
};

/** Default per-project metadata Couch DB name (`metadata-{projectId}`), matching createNotebook. */
const metadataDbNameFromProjectId = (projectId: string): string =>
  METADATA_DATABASE_NAME_PREFIX + projectId;

const metadataDbNameFromProject = (
  project: ProjectDocument
): string | undefined => {
  const projectId = project._id?.trim();
  return projectId ? metadataDbNameFromProjectId(projectId) : undefined;
};

type LegacyProjectMetadataDbRef = {
  metadataDb?: {db_name?: string};
  metadata_db?: {db_name?: string};
};

/** Whether the project doc still stores the deprecated metadataDb / metadata_db reference. */
const projectStillHasMetadataDbRef = (project: ProjectDocument): boolean => {
  const legacy = project as ProjectDocument & LegacyProjectMetadataDbRef;
  return Boolean(legacy.metadataDb?.db_name ?? legacy.metadata_db?.db_name);
};

export const discoverMetadataDatabases = async (): Promise<
  MetadataDatabaseCandidate[]
> => {
  const allDbNames = await listCouchDatabaseNames();
  const byName = new Map<string, MetadataDatabaseCandidate>();

  for (const dbName of allDbNames) {
    if (!isMetadataDatabaseName(dbName)) {
      continue;
    }
    byName.set(dbName, {
      dbName,
      projectId: projectIdFromMetadataDbName(dbName),
      stillReferencedOnProject: false,
      hasInlinedUiSpecification: false,
    });
  }

  let projects: ProjectDocument[] = [];
  try {
    projects = await getAllProjectsDirectory();
  } catch {
    console.warn(
      'Warning: could not read the projects database; listing Couch metadata-* names only.'
    );
  }

  const projectById = new Map(projects.map(p => [p._id, p]));

  for (const project of projects) {
    const dbName = metadataDbNameFromProject(project);
    if (!dbName) {
      continue;
    }
    const existing = byName.get(dbName);
    const projectId = project._id;
    const hasInlinedUiSpecification = Boolean(
      (project as {uiSpecification?: unknown}).uiSpecification
    );
    if (existing) {
      existing.projectId = existing.projectId ?? projectId;
      existing.projectName = project.name;
      existing.stillReferencedOnProject = projectStillHasMetadataDbRef(project);
      existing.hasInlinedUiSpecification = hasInlinedUiSpecification;
    } else {
      byName.set(dbName, {
        dbName,
        projectId,
        projectName: project.name,
        stillReferencedOnProject: projectStillHasMetadataDbRef(project),
        hasInlinedUiSpecification,
      });
    }
  }

  for (const candidate of byName.values()) {
    if (candidate.projectId && !candidate.projectName) {
      const project = projectById.get(candidate.projectId);
      if (project) {
        candidate.projectName = project.name;
        candidate.stillReferencedOnProject =
          projectStillHasMetadataDbRef(project);
        candidate.hasInlinedUiSpecification = Boolean(
          (project as {uiSpecification?: unknown}).uiSpecification
        );
      }
    }
  }

  return [...byName.values()].sort((a, b) => a.dbName.localeCompare(b.dbName));
};

const createPrompt = () =>
  readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

const ask = (rl: readline.Interface, question: string): Promise<string> =>
  new Promise(resolve => {
    rl.question(question, answer => resolve(answer.trim()));
  });

const printBanner = () => {
  console.log('');
  console.log('='.repeat(72));
  console.log('  PERMANENT METADATA DATABASE DELETION');
  console.log('='.repeat(72));
  console.log('');
  console.log('  This script DESTROYS entire CouchDB databases. The operation');
  console.log('  cannot be undone. All documents in each metadata database');
  console.log('  (ui-specification, project-metadata-*, etc.) will be lost.');
  console.log('');
  console.log('  Only run this AFTER:');
  console.log(
    '    • projects/templates DB migrations have inlined uiSpecification'
  );
  console.log('    • you have verified surveys still load correctly');
  console.log('    • you have a current backup of CouchDB');
  console.log('');
  console.log('  This script does NOT delete data-* record databases or the');
  console.log('  projects / templates / auth / people databases.');
  console.log('');
  console.log(`  Couch server: ${config.couchdbInternalUrl}`);
  console.log('');
  console.log('='.repeat(72));
  console.log('');
};

const printCandidates = (candidates: MetadataDatabaseCandidate[]) => {
  if (candidates.length === 0) {
    console.log('No metadata databases found on this Couch server.');
    return;
  }

  console.log(`Found ${candidates.length} metadata database(s):\n`);
  candidates.forEach((c, index) => {
    const n = index + 1;
    const projectLabel = c.projectName
      ? `${c.projectName} (${c.projectId ?? 'unknown id'})`
      : (c.projectId ?? 'no matching project doc');
    const flags: string[] = [];
    if (c.stillReferencedOnProject) {
      flags.push('still referenced on project doc');
    }
    if (c.hasInlinedUiSpecification) {
      flags.push('uiSpecification inlined on project');
    } else if (c.projectId) {
      flags.push(
        'WARNING: no uiSpecification on project — migration may be incomplete'
      );
    }
    console.log(
      `  ${String(n).padStart(3)}. ${c.dbName}\n` +
        `       Survey: ${projectLabel}\n` +
        (flags.length > 0 ? `       Notes: ${flags.join('; ')}\n` : '')
    );
  });
  console.log('');
};

const parseSelection = (
  input: string,
  maxIndex: number
): number[] | 'all' | 'invalid' => {
  const normalized = input.toLowerCase();
  if (normalized === 'all' || normalized === '*') {
    return 'all';
  }
  const parts = input.split(/[\s,]+/).filter(Boolean);
  if (parts.length === 0) {
    return 'invalid';
  }
  const indices: number[] = [];
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 1 || n > maxIndex) {
      return 'invalid';
    }
    if (!indices.includes(n)) {
      indices.push(n);
    }
  }
  indices.sort((a, b) => a - b);
  return indices;
};

const showHelp = () => {
  console.log('Usage: pnpm run delete-metadata-databases [-- options]');
  console.log('');
  console.log('Options:');
  console.log('  --dry-run    List metadata databases only; do not delete');
  console.log('  -h, --help   Show this help');
  console.log('');
};

const main = async () => {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }
  const dryRun = args.includes('--dry-run');

  printBanner();

  const connection = await verifyCouchDBConnection();
  if (!connection.valid) {
    console.error('Cannot reach CouchDB. Aborting.');
    console.error(connection.validate_error ?? connection.server_msg);
    process.exit(1);
  }

  const candidates = await discoverMetadataDatabases();
  printCandidates(candidates);

  if (candidates.length === 0) {
    process.exit(0);
  }

  if (dryRun) {
    console.log('Dry run complete — no databases were deleted.');
    process.exit(0);
  }

  const rl = createPrompt();
  try {
    const proceed = await ask(
      rl,
      'Type "yes" to choose which databases to delete (anything else aborts): '
    );
    if (proceed.toLowerCase() !== 'yes') {
      console.log('Aborted — no databases were deleted.');
      process.exit(0);
    }

    console.log('');
    console.log(
      'Enter "all" to delete every database listed above, or a comma-separated'
    );
    console.log('list of numbers (e.g. 1,3,5):');
    const selectionInput = await ask(rl, '> ');
    const selection = parseSelection(selectionInput, candidates.length);
    if (selection === 'invalid') {
      console.error('Invalid selection. Aborting.');
      process.exit(1);
    }

    const toDelete =
      selection === 'all' ? candidates : selection.map(i => candidates[i - 1]);

    console.log('');
    console.log('You are about to PERMANENTLY DELETE:');
    for (const c of toDelete) {
      console.log(`  • ${c.dbName}`);
    }
    console.log('');

    const unmigratedWarnings = toDelete.filter(
      c => c.projectId && !c.hasInlinedUiSpecification
    );
    if (unmigratedWarnings.length > 0) {
      console.warn(
        'WARNING: Some selected databases belong to projects without inlined'
      );
      console.warn(
        'uiSpecification. Deleting them may make those surveys unusable:'
      );
      for (const c of unmigratedWarnings) {
        console.warn(`  • ${c.dbName} (${c.projectId})`);
      }
      console.warn('');
    }

    const expectedPhrase = `${CONFIRMATION_PHRASE} ${toDelete.length}`;
    console.log(`To confirm, type exactly: ${expectedPhrase}`);
    const confirmation = await ask(rl, '> ');
    if (confirmation !== expectedPhrase) {
      console.log('Confirmation phrase did not match. Aborting.');
      process.exit(1);
    }

    console.log('');
    for (const c of toDelete) {
      process.stdout.write(`Deleting ${c.dbName}... `);
      try {
        await destroyCouchDatabase(c.dbName);
        console.log('done');
      } catch (error) {
        console.log('FAILED');
        console.error(error);
        process.exit(1);
      }
    }

    console.log('');
    console.log(`Deleted ${toDelete.length} metadata database(s).`);
  } finally {
    rl.close();
  }

  process.exit(0);
};

main().catch(error => {
  console.error('deleteMetadataDatabases failed:', error);
  process.exit(1);
});
