// SPDX-License-Identifier: Apache-2.0
/* eslint-disable n/no-process-exit */
/**
 * seedPaginationDataset.ts
 *
 * Bulk fixture seed for Control Centre pagination (teams, templates,
 * surveys/notebooks, and users). Distinct from seedTestDataset.ts: that
 * script creates a small, permission-testing persona matrix; this one
 * mints a large, labelled set so list pages have multiple pages.
 *
 * Creates (or restores) COUNT of each resource with stable IDs:
 *
 *   team_bulk_001        Bulk Team 001
 *   template_bulk_001    Bulk Template 001  (owned by team_bulk_001)
 *   notebook_bulk_001    Bulk Survey 001    (owned by team_bulk_001)
 *   bulk-user-001@faims.test  Bulk User 001 (TEAM_MEMBER of matching team,
 *                             PROJECT_CONTRIBUTOR of matching survey)
 *
 * Usage (from api/):
 *   pnpm run seed-pagination-dataset
 *
 * Environment variables:
 *   BULK_SEED_COUNT      How many of each resource to upsert. Default 100.
 *   TEST_SEED_PASSWORD   Shared password for bulk users.
 *                        Defaults to "TestPassword123!".
 *   BULK_SEED_NOTEBOOK   Path to the notebook JSON used for every template
 *                        and survey. Defaults to "./notebooks/e2e-minimal.json".
 *
 * Safety: refuses to run unless COUCHDB_INTERNAL_URL (and
 * CONDUCTOR_PUBLIC_URL when set) look like a development target — hostname
 * localhost / 127.0.0.1 / ::1, the word "dev", or an http:// (not https)
 * URL. This is a volume script; do not point it at production.
 *
 * Safe to re-run: bulk entities are restored in place via stable IDs. Only
 * those documents and bulk-user-*@faims.test personas are created or
 * updated; nothing is deleted.
 */

import {
  addProjectRole,
  addTeamRole,
  buildUiSpecProperties,
  ExistingPeopleDBDocument,
  ExistingProjectDocument,
  ExistingTeamsDBDocument,
  ExistingTemplateDocument,
  PeopleDBDocument,
  ProjectDocument,
  ProjectStatus,
  Role,
  ROOT_DESCRIPTION_MAX_LENGTH,
  normalizeRootDescriptionForStore,
  safeWriteDocument,
  TemplateDocument,
} from '@faims3/data-model';
import {readFileSync} from 'fs';
import {addLocalPasswordForUser} from '../auth/helpers';
import {config} from '../buildconfig';
import {
  getTeamsDB,
  getTemplatesDb,
  initialiseAndMigrateDBs,
  initialiseDataDb,
  localGetProjectsDb,
  registerDataDbAtCurrentVersion,
} from '../couchdb';
import {
  getProjectById,
  normalizeUiSpecificationOrThrow,
} from '../couchdb/notebooks';
import {getTemplate} from '../couchdb/templates';
import {
  createUser,
  getCouchUserFromEmailOrUserId,
  saveCouchUser,
} from '../couchdb/users';
import * as Exceptions from '../exceptions';
import {nowIso} from '../time';

// ──────────────────────────────────────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────────────────────────────────────

const SEED_PASSWORD = process.env.TEST_SEED_PASSWORD || 'TestPassword123!';
const SEED_CREATED_BY = 'pagination-seed-script';
const DEFAULT_COUNT = 100;
const DEFAULT_NOTEBOOK_PATH = './notebooks/e2e-minimal.json';
const ID_PAD = 3;

const COUNT = parseCount(process.env.BULK_SEED_COUNT);
const NOTEBOOK_PATH = process.env.BULK_SEED_NOTEBOOK || DEFAULT_NOTEBOOK_PATH;

function parseCount(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_COUNT;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(
      `BULK_SEED_COUNT must be a positive integer (got ${JSON.stringify(raw)})`
    );
  }
  return parsed;
}

function padIndex(index: number): string {
  return String(index).padStart(ID_PAD, '0');
}

function bulkTeamId(index: number): string {
  return `team_bulk_${padIndex(index)}`;
}

function bulkTemplateId(index: number): string {
  return `template_bulk_${padIndex(index)}`;
}

function bulkNotebookId(index: number): string {
  return `notebook_bulk_${padIndex(index)}`;
}

function bulkUserEmail(index: number): string {
  return `bulk-user-${padIndex(index)}@faims.test`;
}

/**
 * A URL is treated as a development target when it uses http:// (not https),
 * or its host is loopback, or the URL/host contains "dev" / "localhost".
 */
function urlLooksDevLike(url: string): boolean {
  const lower = url.trim().toLowerCase();
  if (!lower) {
    return false;
  }
  if (
    lower.includes('localhost') ||
    lower.includes('127.0.0.1') ||
    lower.includes('[::1]') ||
    lower.includes('dev')
  ) {
    return true;
  }
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '0.0.0.0' ||
      host.includes('dev')
    ) {
      return true;
    }
    return parsed.protocol.toLowerCase() === 'http:';
  } catch {
    return lower.startsWith('http://');
  }
}

function assertDevLikeTarget(): void {
  const checks: Array<[string, string | undefined]> = [
    ['COUCHDB_INTERNAL_URL', config.couchdbInternalUrl],
    ['CONDUCTOR_PUBLIC_URL', config.conductorPublicUrl],
  ];
  if (config.couchdbPublicUrl) {
    checks.push(['COUCHDB_PUBLIC_URL', config.couchdbPublicUrl]);
  }

  const failures = checks.filter(([, url]) => !url || !urlLooksDevLike(url));
  if (failures.length === 0) {
    console.log('Dev-target check passed:');
    for (const [label, url] of checks) {
      console.log(`  ${label}=${url}`);
    }
    return;
  }

  const detail = failures
    .map(
      ([label, url]) =>
        `  ${label}=${url ?? '(unset)'}  (needs localhost, http://, or "dev")`
    )
    .join('\n');
  throw new Error(
    `Refusing to seed pagination data against a non-development URL.\n${detail}\n` +
      'This script writes ~100 teams, templates, surveys and users. Point it at ' +
      'a local/dev CouchDB (localhost, http://, or a host containing "dev").'
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

interface NotebookSpec {
  name: string;
  description?: string;
  uiSpecification: Record<string, unknown>;
}

function loadNotebookJson(path: string): NotebookSpec {
  const raw = readFileSync(path, 'utf-8');
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  if (!parsed.name || !parsed.uiSpecification) {
    throw new Error(
      `Notebook file ${path} is missing required 'name' or 'uiSpecification' fields`
    );
  }
  return parsed as unknown as NotebookSpec;
}

function clampDescription(description?: string): string | undefined {
  const trimmed = description?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.length > ROOT_DESCRIPTION_MAX_LENGTH
    ? trimmed.slice(0, ROOT_DESCRIPTION_MAX_LENGTH)
    : trimmed;
}

function seedDescription(description?: string): string | undefined {
  return normalizeRootDescriptionForStore(clampDescription(description));
}

function isNotFoundError(error: unknown): boolean {
  if (error instanceof Exceptions.ItemNotFoundException) {
    return true;
  }
  const status = (error as {status?: number} | null)?.status;
  const name = (error as {name?: string} | null)?.name;
  return status === 404 || name === 'not_found';
}

function logProgress(label: string, index: number, total: number): void {
  if (index === 1 || index === total || index % 10 === 0) {
    console.log(`  … ${label} ${index}/${total}`);
  }
}

async function upsertBulkTeam({
  id,
  name,
  description,
  now,
}: {
  id: string;
  name: string;
  description: string;
  now: number;
}): Promise<ExistingTeamsDBDocument> {
  const teamsDb = getTeamsDB();
  try {
    const existing = await teamsDb.get(id);
    const updated = {
      ...existing,
      name,
      description,
      createdBy: SEED_CREATED_BY,
      updatedAt: now,
      archived: false,
    };
    await safeWriteDocument({db: teamsDb, data: updated});
    return await teamsDb.get(id);
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
    await teamsDb.put({
      _id: id,
      name,
      description,
      createdAt: now,
      updatedAt: now,
      createdBy: SEED_CREATED_BY,
    });
    return await teamsDb.get(id);
  }
}

async function upsertBulkTemplate({
  id,
  name,
  description,
  uiSpecification,
  uiSpecProperties,
  teamId,
}: {
  id: string;
  name: string;
  description?: string;
  uiSpecification: ReturnType<typeof normalizeUiSpecificationOrThrow>;
  uiSpecProperties: Awaited<ReturnType<typeof buildUiSpecProperties>>;
  teamId: string;
}): Promise<ExistingTemplateDocument> {
  const templatesDb = getTemplatesDb();
  const now = nowIso();

  try {
    const existing = await getTemplate(id);
    const updated: ExistingTemplateDocument = {
      ...existing,
      name,
      description,
      uiSpecification,
      uiSpecProperties,
      ownedByTeamId: teamId,
      createdBy: SEED_CREATED_BY,
      archived: false,
      isPublic: false,
      version: existing.version + 1,
      updatedAt: now,
    };
    await safeWriteDocument({db: templatesDb, data: updated});
    return await getTemplate(id);
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
    const templateDoc: TemplateDocument = {
      _id: id,
      version: 1,
      archived: false,
      isPublic: false,
      uiSpecification,
      uiSpecProperties,
      ownedByTeamId: teamId,
      name,
      description,
      createdBy: SEED_CREATED_BY,
      createdAt: now,
      updatedAt: now,
    };
    await templatesDb.put(templateDoc);
    return await getTemplate(id);
  }
}

async function upsertBulkNotebook({
  id,
  projectName,
  description,
  uiSpecification,
  uiSpecProperties,
  templateId,
  teamId,
}: {
  id: string;
  projectName: string;
  description?: string;
  uiSpecification: ReturnType<typeof normalizeUiSpecificationOrThrow>;
  uiSpecProperties: Awaited<ReturnType<typeof buildUiSpecProperties>>;
  templateId: string;
  teamId: string;
}): Promise<string> {
  const projectsDb = localGetProjectsDb();
  const now = nowIso();
  const dataDBName = `data-${id}`;

  let existing: ExistingProjectDocument | undefined;
  try {
    existing = await getProjectById(id);
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }

  if (existing) {
    const updated: ProjectDocument = {
      ...existing,
      name: projectName.trim(),
      templateId,
      ownedByTeamId: teamId,
      createdBy: SEED_CREATED_BY,
      status: ProjectStatus.OPEN,
      uiSpecification,
      uiSpecProperties,
      updatedAt: now,
      dataDb: existing.dataDb ?? {db_name: dataDBName},
    };
    if (description !== undefined) {
      updated.description = description;
    } else {
      delete updated.description;
    }
    await safeWriteDocument({db: projectsDb, data: updated});
    await initialiseDataDb({projectId: id, force: true});
    await registerDataDbAtCurrentVersion({
      project: updated,
      launchedBy: SEED_CREATED_BY,
    });
    return id;
  }

  const projectDoc: ProjectDocument = {
    _id: id,
    name: projectName.trim(),
    ...(description !== undefined ? {description} : {}),
    templateId,
    dataDb: {
      db_name: dataDBName,
    },
    status: ProjectStatus.OPEN,
    ownedByTeamId: teamId,
    createdBy: SEED_CREATED_BY,
    createdAt: now,
    updatedAt: now,
    uiSpecification,
    uiSpecProperties,
  };
  await projectsDb.put(projectDoc);
  await initialiseDataDb({projectId: id, force: true});
  await registerDataDbAtCurrentVersion({
    project: projectDoc,
    launchedBy: SEED_CREATED_BY,
  });
  return id;
}

function resetBulkUserBaseline(
  user: ExistingPeopleDBDocument | PeopleDBDocument,
  {email, name}: {email: string; name: string}
): PeopleDBDocument {
  user.name = name;
  user.disabled = false;
  user.emails = [{email: email.toLowerCase(), verified: true}];
  user.globalRoles = [Role.GENERAL_USER];
  user.teamRoles = [];
  user.projectRoles = [];
  user.templateRoles = [];
  return user;
}

async function upsertBulkUser({
  email,
  name,
  teamId,
  projectId,
}: {
  email: string;
  name: string;
  teamId: string;
  projectId: string;
}): Promise<PeopleDBDocument> {
  const existing = await getCouchUserFromEmailOrUserId(email);
  let user: PeopleDBDocument;

  if (existing) {
    user = resetBulkUserBaseline(existing, {email, name});
  } else {
    const [created, error] = await createUser({
      email,
      name,
      verified: true,
    });
    if (!created) {
      throw new Error(`Failed to create user ${email}: ${error}`);
    }
    user = created;
  }

  addTeamRole({user, role: Role.TEAM_MEMBER, teamId});
  addProjectRole({
    user,
    role: Role.PROJECT_CONTRIBUTOR,
    projectId,
  });

  await saveCouchUser(user);
  await addLocalPasswordForUser(user, SEED_PASSWORD);
  return user;
}

function printSummary({
  count,
  firstTeamId,
  lastTeamId,
  firstTemplateId,
  lastTemplateId,
  firstNotebookId,
  lastNotebookId,
  firstUserEmail,
  lastUserEmail,
}: {
  count: number;
  firstTeamId: string;
  lastTeamId: string;
  firstTemplateId: string;
  lastTemplateId: string;
  firstNotebookId: string;
  lastNotebookId: string;
  firstUserEmail: string;
  lastUserEmail: string;
}): void {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('            PAGINATION DATASET SEED COMPLETE                ');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`Upserted ${count} of each: teams, templates, surveys, users.\n`);
  console.log('TEAMS');
  console.log(`  ${firstTeamId}  …  ${lastTeamId}`);
  console.log('TEMPLATES');
  console.log(`  ${firstTemplateId}  …  ${lastTemplateId}`);
  console.log('SURVEYS (notebooks)');
  console.log(`  ${firstNotebookId}  …  ${lastNotebookId}`);
  console.log('USERS');
  console.log(`  ${firstUserEmail}  …  ${lastUserEmail}`);
  console.log('\nCREDENTIALS (all bulk users share this password)');
  console.log(`  Password : ${SEED_PASSWORD}`);
  console.log(
    '\nEach user is TEAM_MEMBER of the matching team and PROJECT_CONTRIBUTOR'
  );
  console.log(
    'of the matching survey. Log in as admin to see every list page.\n'
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────

const main = async () => {
  try {
    assertDevLikeTarget();

    console.log(
      `\nSeeding ${COUNT} teams, templates, surveys and users for pagination…`
    );

    console.log(
      '\nPhase 1: Initialising databases (design docs; data preserved)...'
    );
    await initialiseAndMigrateDBs({force: true, pushKeys: false});
    console.log('✓ Databases initialised');

    const notebookSpec = loadNotebookJson(NOTEBOOK_PATH);
    const uiSpecification = normalizeUiSpecificationOrThrow(
      notebookSpec.uiSpecification
    );
    const uiSpecProperties = await buildUiSpecProperties(uiSpecification);
    const description = seedDescription(
      `Pagination fixture copied from ${notebookSpec.name}`
    );

    console.log('\nPhase 2: Upserting teams...');
    const now = Date.now();
    for (let index = 1; index <= COUNT; index++) {
      await upsertBulkTeam({
        id: bulkTeamId(index),
        name: `Bulk Team ${padIndex(index)}`,
        description: `Pagination fixture team ${padIndex(index)}`,
        now,
      });
      logProgress('teams', index, COUNT);
    }
    console.log(`✓ ${COUNT} teams`);

    console.log('\nPhase 3: Upserting templates...');
    for (let index = 1; index <= COUNT; index++) {
      await upsertBulkTemplate({
        id: bulkTemplateId(index),
        name: `Bulk Template ${padIndex(index)}`,
        description,
        uiSpecification,
        uiSpecProperties,
        teamId: bulkTeamId(index),
      });
      logProgress('templates', index, COUNT);
    }
    console.log(`✓ ${COUNT} templates`);

    console.log('\nPhase 4: Upserting surveys (notebooks)...');
    console.log('  (each survey initialises a data DB; this is the slow step)');
    for (let index = 1; index <= COUNT; index++) {
      await upsertBulkNotebook({
        id: bulkNotebookId(index),
        projectName: `Bulk Survey ${padIndex(index)}`,
        description,
        uiSpecification,
        uiSpecProperties,
        templateId: bulkTemplateId(index),
        teamId: bulkTeamId(index),
      });
      logProgress('surveys', index, COUNT);
    }
    console.log(`✓ ${COUNT} surveys`);

    console.log('\nPhase 5: Upserting users...');
    for (let index = 1; index <= COUNT; index++) {
      await upsertBulkUser({
        email: bulkUserEmail(index),
        name: `Bulk User ${padIndex(index)}`,
        teamId: bulkTeamId(index),
        projectId: bulkNotebookId(index),
      });
      logProgress('users', index, COUNT);
    }
    console.log(`✓ ${COUNT} users`);

    printSummary({
      count: COUNT,
      firstTeamId: bulkTeamId(1),
      lastTeamId: bulkTeamId(COUNT),
      firstTemplateId: bulkTemplateId(1),
      lastTemplateId: bulkTemplateId(COUNT),
      firstNotebookId: bulkNotebookId(1),
      lastNotebookId: bulkNotebookId(COUNT),
      firstUserEmail: bulkUserEmail(1),
      lastUserEmail: bulkUserEmail(COUNT),
    });

    process.exit(0);
  } catch (error) {
    console.error('\n✗ Pagination seed failed:', error);
    process.exit(1);
  }
};

void main();
