// SPDX-License-Identifier: Apache-2.0
/* eslint-disable n/no-process-exit */
/**
 * seedPaginationDataset.ts
 *
 * Bulk fixture seed for Control Centre pagination (teams, templates,
 * surveys/notebooks, users, map layers and invites). Distinct from
 * seedTestDataset.ts: that
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
 *   asset-bulk-001       Bulk Map Layer 001
 *   bulk-invite-global-001 / -team-001 / -survey-001   Bulk … Invite 001
 *
 * Lists that belong to one team or one survey would hold a single row if
 * the fixtures were spread evenly, so the first team and survey also get
 * the lot: every bulk user is a TEAM_MEMBER of team_bulk_001 and a
 * PROJECT_CONTRIBUTOR of notebook_bulk_001, every map layer is owned by
 * team_bulk_001 and linked to notebook_bulk_001, and the team and survey
 * invites are all for those two. Their Members, Users, Map layers and
 * Invites tabs then have several pages.
 *
 * Map layers are documents only, with no uploaded file. They are stored as
 * `failed` so no spatial worker picks them up; they list and link, but
 * cannot be downloaded and never appear as ready layers.
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
 * updated; nothing is deleted. A re-run also renews the bulk invites, which
 * otherwise expire and drop out of the invite lists.
 */

import {
  addProjectRole,
  addTeamRole,
  buildUiSpecProperties,
  DEFAULT_INVITE_EXPIRY_MS,
  DEFAULT_MAP_ASSET_STYLE,
  ExistingPeopleDBDocument,
  ExistingProjectDocument,
  ExistingTeamsDBDocument,
  ExistingTemplateDocument,
  InvitesDBFields,
  MAP_ASSET_DOC_TYPE,
  MapAssetFields,
  PeopleDBDocument,
  ProjectDocument,
  ProjectStatus,
  Resource,
  Role,
  RoleScope,
  ROOT_DESCRIPTION_MAX_LENGTH,
  normalizeRootDescriptionForStore,
  safeWriteDocument,
  TemplateDocument,
} from '@faims3/data-model';
import {readFileSync} from 'fs';
import {addLocalPasswordForUser} from '../auth/helpers';
import {config} from '../buildconfig';
import {
  getInvitesDB,
  getMapAssetsDB,
  getTeamsDB,
  getTemplatesDb,
  initialiseAndMigrateDBs,
  initialiseDataDb,
  localGetProjectsDb,
  registerDataDbAtCurrentVersion,
} from '../couchdb';
import {linkMapAsset} from '../couchdb/mapAssets/store';
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

function bulkMapAssetId(index: number): string {
  return `asset-bulk-${padIndex(index)}`;
}

type BulkInviteScope = 'global' | 'team' | 'survey';

function bulkInviteId(scope: BulkInviteScope, index: number): string {
  return `bulk-invite-${scope}-${padIndex(index)}`;
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
      'This script writes ~100 teams, templates, surveys, users, map layers ' +
      'and invites. Point it at ' +
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

/**
 * Creates or resets one bulk user with a role on each given team and survey.
 */
async function upsertBulkUser({
  email,
  name,
  teamIds,
  projectIds,
}: {
  email: string;
  name: string;
  teamIds: string[];
  projectIds: string[];
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

  for (const teamId of new Set(teamIds)) {
    addTeamRole({user, role: Role.TEAM_MEMBER, teamId});
  }
  for (const projectId of new Set(projectIds)) {
    addProjectRole({user, role: Role.PROJECT_CONTRIBUTOR, projectId});
  }

  await saveCouchUser(user);
  await addLocalPasswordForUser(user, SEED_PASSWORD);
  return user;
}

/**
 * Creates or restores one map-layer document owned by `teamId` and links it
 * to `projectId`. No file is uploaded: the layer is stored as `failed`, a
 * finished state, so spatial workers leave it alone. `createdAt` is kept on
 * re-run so the layer keeps its place in the newest-first lists.
 */
async function upsertBulkMapAsset({
  id,
  name,
  teamId,
  projectId,
  createdAt,
}: {
  id: string;
  name: string;
  teamId: string;
  projectId: string;
  createdAt: number;
}): Promise<void> {
  const db = getMapAssetsDB();
  const now = Date.now();
  const fields: MapAssetFields = {
    docType: MAP_ASSET_DOC_TYPE,
    name,
    description: 'Pagination fixture. No file was uploaded for this layer.',
    ownedByTeamId: teamId,
    createdBy: SEED_CREATED_BY,
    originalFilename: 'pagination-fixture.geojson',
    byteSize: 0,
    status: 'failed',
    failureReason: 'Pagination fixture: no file was uploaded.',
    defaultStyle: DEFAULT_MAP_ASSET_STYLE,
    createdAt,
    updatedAt: now,
  };
  try {
    const existing = await db.get(id);
    await db.put({
      ...fields,
      _id: id,
      _rev: existing._rev,
      createdAt: (existing as {createdAt?: number}).createdAt ?? createdAt,
    });
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
    await db.put({_id: id, ...fields});
  }
  // Returns the existing link when the layer is already linked.
  await linkMapAsset({assetId: id, projectId, linkedBy: SEED_CREATED_BY});
}

/**
 * Creates or renews one unused single-use invite under a stable id. A global
 * invite grants GENERAL_USER; a team invite TEAM_MEMBER on `resourceId`; a
 * survey invite PROJECT_GUEST on `resourceId`. The expiry is pushed out on
 * every run because expired invites are left out of the invite lists.
 */
async function upsertBulkInvite({
  scope,
  index,
  resourceId,
  createdAt,
}: {
  scope: BulkInviteScope;
  index: number;
  resourceId?: string;
  createdAt: number;
}): Promise<void> {
  const db = getInvitesDB();
  const id = bulkInviteId(scope, index);
  const label = {global: 'Global', team: 'Team', survey: 'Survey'}[scope];
  const fields: InvitesDBFields = {
    name: `Bulk ${label} Invite ${padIndex(index)}`,
    expiry: Date.now() + DEFAULT_INVITE_EXPIRY_MS,
    createdBy: SEED_CREATED_BY,
    createdAt,
    usesOriginal: 1,
    usesConsumed: 0,
    uses: [],
    ...(scope === 'global'
      ? {inviteType: RoleScope.GLOBAL, role: Role.GENERAL_USER}
      : {
          inviteType: RoleScope.RESOURCE_SPECIFIC,
          resourceType: scope === 'team' ? Resource.TEAM : Resource.PROJECT,
          resourceId,
          role: scope === 'team' ? Role.TEAM_MEMBER : Role.PROJECT_GUEST,
        }),
  };
  try {
    const existing = await db.get(id);
    await db.put({
      ...fields,
      _id: id,
      _rev: existing._rev,
      createdAt: (existing as {createdAt?: number}).createdAt ?? createdAt,
    });
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
    await db.put({_id: id, ...fields});
  }
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
  firstMapAssetId,
  lastMapAssetId,
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
  firstMapAssetId: string;
  lastMapAssetId: string;
}): void {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('            PAGINATION DATASET SEED COMPLETE                ');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(
    `Upserted ${count} of each: teams, templates, surveys, users, map layers,`
  );
  console.log('and global, team and survey invites.\n');
  console.log('TEAMS');
  console.log(`  ${firstTeamId}  …  ${lastTeamId}`);
  console.log('TEMPLATES');
  console.log(`  ${firstTemplateId}  …  ${lastTemplateId}`);
  console.log('SURVEYS (notebooks)');
  console.log(`  ${firstNotebookId}  …  ${lastNotebookId}`);
  console.log('USERS');
  console.log(`  ${firstUserEmail}  …  ${lastUserEmail}`);
  console.log('MAP LAYERS (documents only, stored as failed; no file)');
  console.log(`  ${firstMapAssetId}  …  ${lastMapAssetId}`);
  console.log('INVITES (single use, renewed on every run)');
  for (const scope of ['global', 'team', 'survey'] as const) {
    console.log(
      `  ${bulkInviteId(scope, 1)}  …  ${bulkInviteId(scope, count)}`
    );
  }
  console.log('\nCREDENTIALS (all bulk users share this password)');
  console.log(`  Password : ${SEED_PASSWORD}`);
  console.log(
    '\nEach user is TEAM_MEMBER of the matching team and PROJECT_CONTRIBUTOR'
  );
  console.log('of the matching survey.');
  console.log(
    `\n${firstTeamId} and ${firstNotebookId} also hold every bulk user, map`
  );
  console.log(
    'layer and team/survey invite, so their Members, Users, Map layers and'
  );
  console.log(
    'Invites tabs have several pages. Log in as admin to see every list page.\n'
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────

const main = async () => {
  try {
    assertDevLikeTarget();

    console.log(
      `\nSeeding ${COUNT} teams, templates, surveys, users, map layers and invites for pagination…`
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
        teamIds: [bulkTeamId(index), bulkTeamId(1)],
        projectIds: [bulkNotebookId(index), bulkNotebookId(1)],
      });
      logProgress('users', index, COUNT);
    }
    console.log(`✓ ${COUNT} users`);

    // New fixtures get distinct, ascending creation times so the
    // newest-first lists show them in a predictable order: 001 is oldest.
    const fixtureCreatedAt = (index: number) => now - (COUNT - index);

    console.log('\nPhase 6: Upserting map layers...');
    for (let index = 1; index <= COUNT; index++) {
      await upsertBulkMapAsset({
        id: bulkMapAssetId(index),
        name: `Bulk Map Layer ${padIndex(index)}`,
        teamId: bulkTeamId(1),
        projectId: bulkNotebookId(1),
        createdAt: fixtureCreatedAt(index),
      });
      logProgress('map layers', index, COUNT);
    }
    console.log(`✓ ${COUNT} map layers`);

    console.log('\nPhase 7: Upserting invites...');
    for (let index = 1; index <= COUNT; index++) {
      const createdAt = fixtureCreatedAt(index);
      await upsertBulkInvite({scope: 'global', index, createdAt});
      await upsertBulkInvite({
        scope: 'team',
        index,
        resourceId: bulkTeamId(1),
        createdAt,
      });
      await upsertBulkInvite({
        scope: 'survey',
        index,
        resourceId: bulkNotebookId(1),
        createdAt,
      });
      logProgress('invites', index, COUNT);
    }
    console.log(`✓ ${COUNT} global, team and survey invites`);

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
      firstMapAssetId: bulkMapAssetId(1),
      lastMapAssetId: bulkMapAssetId(COUNT),
    });

    process.exit(0);
  } catch (error) {
    console.error('\n✗ Pagination seed failed:', error);
    process.exit(1);
  }
};

void main();
