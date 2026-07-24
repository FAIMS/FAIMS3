/* eslint-disable n/no-process-exit */
/**
 * seedTestDataset.ts
 *
 * Idempotent test-data seed script.
 *
 * Creates (or restores) a deterministic, permission-testing dataset in the
 * configured CouchDB instance.  The script:
 *
 *   1. Ensures databases / design docs are initialised (does not wipe data).
 *   2. Upserts two teams: Red Team and Blue Team (stable IDs).
 *   3. Upserts one template and one notebook (survey) owned by each team,
 *      sourced from the JSON files under api/notebooks/.
 *   4. Upserts a set of deterministic users that collectively cover every
 *      role defined in roleDetails, with cross-team memberships designed to
 *      exercise permission-visibility scenarios.
 *
 * Usage:
 *   env-cmd ts-node src/scripts/seedTestDataset.ts
 *
 * Environment variables:
 *   TEST_SEED_PASSWORD   Shared password for all seeded users.
 *                        Defaults to "TestPassword123!".
 *   TEST_SEED_NOTEBOOKS  Comma-separated paths to notebook JSON files.
 *                        Defaults to "./notebooks/e2e-minimal.json,
 *                        ./notebooks/sample_notebook.json"
 *                        (Red = minimal one-field notebook for app record
 *                        CRUD e2e; Blue = sample survey).
 *
 * Safe to re-run: seeded entities are restored to the intended state via
 * stable document IDs. Only those canonical seed documents and seed persona
 * emails are created or updated; nothing is deleted.
 */

import {
  addGlobalRole,
  addProjectRole,
  addTeamRole,
  addTemplateRole,
  ExistingPeopleDBDocument,
  ExistingProjectDocument,
  ExistingTeamsDBDocument,
  ExistingTemplateDocument,
  PeopleDBDocument,
  ProjectDocument,
  ProjectStatus,
  Role,
  roleDetails,
  ROOT_DESCRIPTION_MAX_LENGTH,
  normalizeRootDescriptionForStore,
  safeWriteDocument,
  TemplateDocument,
} from '@faims3/data-model';
import {readFileSync} from 'fs';
import {addLocalPasswordForUser} from '../auth/helpers';
import {
  getTeamsDB,
  getTemplatesDb,
  initialiseAndMigrateDBs,
  initialiseDataDb,
  localGetProjectsDb,
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
const SEED_CREATED_BY = 'seed-script';

/** Stable document IDs so re-runs update in place instead of minting duplicates. */
const SEED_IDS = {
  redTeam: 'team_seed_red',
  blueTeam: 'team_seed_blue',
  redTemplate: 'template_seed_red',
  blueTemplate: 'template_seed_blue',
  redNotebook: 'notebook_seed_red',
  blueNotebook: 'notebook_seed_blue',
} as const;

const DEFAULT_NOTEBOOK_PATHS = [
  './notebooks/e2e-minimal.json',
  './notebooks/sample_notebook.json',
];

const NOTEBOOK_PATHS = process.env.TEST_SEED_NOTEBOOKS
  ? process.env.TEST_SEED_NOTEBOOKS.split(',').map(p => p.trim())
  : DEFAULT_NOTEBOOK_PATHS;

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

interface SeedContext {
  redTeamId: string;
  blueTeamId: string;
  redTemplateId: string;
  blueTemplateId: string;
  redNotebookId: string;
  blueNotebookId: string;
}

interface UserSpec {
  email: string;
  name: string;
  tag: string; // short identifier for summary output
  /** Global roles to assign (beyond the default GENERAL_USER). */
  globalRoles?: Role[];
  /** Called once team/template/notebook IDs are available. */
  assignResourceRoles?: (user: PeopleDBDocument, ctx: SeedContext) => void;
}

// ──────────────────────────────────────────────────────────────────────────────
// User matrix
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Deterministic user matrix.
 *
 * Together these users cover every role in the Role enum:
 *
 *   Global:   GENERAL_USER (all), GENERAL_ADMIN, GENERAL_CREATOR, OPERATIONS_ADMIN
 *   Team:     TEAM_MEMBER, TEAM_MEMBER_CREATOR, TEAM_MANAGER, TEAM_ADMIN
 *   Template: TEMPLATE_GUEST, TEMPLATE_ADMIN
 *   Project:  PROJECT_GUEST, PROJECT_CONTRIBUTOR, PROJECT_MANAGER, PROJECT_ADMIN
 */
const USER_SPECS: UserSpec[] = [
  // ── seed-admin ────────────────────────────────────────────────────────────
  // Operations Admin user with no team memberships
  {
    email: 'seed-admin@faims.test',
    tag: 'OPERATIONS_ADMIN',
    name: 'Seed Administrator',
    globalRoles: [Role.OPERATIONS_ADMIN],
    // TEMPLATE_ADMIN on Red so e2e can exercise visibility/archive Actions
    // (ops global roles alone do not grant READ on private team templates).
    assignResourceRoles(user, ctx) {
      addTemplateRole({
        user,
        role: Role.TEMPLATE_ADMIN,
        templateId: ctx.redTemplateId,
      });
      addProjectRole({
        user,
        role: Role.PROJECT_ADMIN,
        projectId: ctx.blueNotebookId,
      });
    },
  },

  // ── seed-manager-blue ────────────────────────────────────────────────────
  // TEAM_MANAGER on Blue
  // Manager for the blue team
  {
    email: 'seed-manager-blue@faims.test',
    tag: 'MANAGER_BLUE',
    name: 'Blue Team Manager',
    assignResourceRoles(user, ctx) {
      addTeamRole({user, role: Role.TEAM_MANAGER, teamId: ctx.blueTeamId});
    },
  },

  // ── seed-manager-red ────────────────────────────────────────────────────
  // TEAM_MANAGER on Red
  // Manager for the red team
  {
    email: 'seed-manager-red@faims.test',
    tag: 'MANAGER_RED',
    name: 'Red Team Manager',
    assignResourceRoles(user, ctx) {
      addTeamRole({user, role: Role.TEAM_MANAGER, teamId: ctx.redTeamId});
    },
  },

  // ── seed-admin-red ────────────────────────────────────────────────────
  // TEAM_ADMIN on Red
  // Admin for the red team
  {
    email: 'seed-admin-red@faims.test',
    tag: 'ADMIN_RED',
    name: 'Red Team Admin',
    assignResourceRoles(user, ctx) {
      addTeamRole({user, role: Role.TEAM_ADMIN, teamId: ctx.redTeamId});
    },
  },

  // ── seed-manager-cross ────────────────────────────────────────────────────
  // TEAM_MANAGER on Red and TEAM_MEMBER on Blue.
  // Exercises visibility differences across teams for the same user.
  {
    email: 'seed-manager-cross@faims.test',
    name: 'Cross-Team Manager',
    tag: 'MANAGER_CROSS',
    assignResourceRoles(user, ctx) {
      addTeamRole({user, role: Role.TEAM_MANAGER, teamId: ctx.redTeamId});
      addTeamRole({user, role: Role.TEAM_MEMBER, teamId: ctx.blueTeamId});
    },
  },

  // ── seed-member-both ──────────────────────────────────────────────────────
  // Plain TEAM_MEMBER on both teams only.
  // Exercises member-level visibility across both teams.
  {
    email: 'seed-member-both@faims.test',
    name: 'Dual Team Member',
    tag: 'MEMBER_BOTH',
    assignResourceRoles(user, ctx) {
      addTeamRole({user, role: Role.TEAM_MEMBER, teamId: ctx.redTeamId});
      addTeamRole({user, role: Role.TEAM_MEMBER, teamId: ctx.blueTeamId});
    },
  },

  // ── seed-red-member-creator ──────────────────────────────────────────────────────
  // TEAM_MEMBER_CREATOR on the red team only.
  // Exercises member-creator role
  {
    email: 'seed-red-member-creator@faims.test',
    tag: 'RED_MEMBER_CREATOR',
    name: 'Red Team Member-Creator',
    assignResourceRoles(user, ctx) {
      addTeamRole({
        user,
        role: Role.TEAM_MEMBER_CREATOR,
        teamId: ctx.redTeamId,
      });
    },
  },

  // ── seed-user ──────────────────────────────────────────────────────────
  // Lowest level user with no roles beyond the default GENERAL_USER.
  {
    email: 'seed-user@faims.test',
    name: 'General User',
    tag: 'USER',
    globalRoles: [],
    assignResourceRoles() {},
  },

  // ── seed-project-contributor ──────────────────────────────────────────────
  // Project contributor on Red Team notebook only (no team membership).
  {
    email: 'seed-project-contributor@faims.test',
    name: 'Project Contributor',
    tag: 'PROJECT_CONTRIBUTOR',
    assignResourceRoles(user, ctx) {
      addProjectRole({
        user,
        role: Role.PROJECT_CONTRIBUTOR,
        projectId: ctx.redNotebookId,
      });
    },
  },

  // ── seed-project-guest ────────────────────────────────────────────────────
  // Project guest on Blue Team notebook only — restricted visibility.
  {
    email: 'seed-project-guest@faims.test',
    tag: 'PROJECT_GUEST',
    name: 'Project Guest',
    assignResourceRoles(user, ctx) {
      addProjectRole({
        user,
        role: Role.PROJECT_GUEST,
        projectId: ctx.blueNotebookId,
      });
    },
  },
];

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

/**
 * Clamp a description to the persisted root-description maximum so seeded
 * documents stay within the schema-enforced limit.
 */
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

async function upsertSeedTeam({
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
    };
    await safeWriteDocument({db: teamsDb, data: updated});
    console.log(`  ✓ Updated team ${name} : ${id}`);
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
    console.log(`  ✓ Created team ${name} : ${id}`);
    return await teamsDb.get(id);
  }
}

async function upsertSeedTemplate({
  id,
  name,
  description,
  uiSpecification,
  teamId,
}: {
  id: string;
  name: string;
  description?: string;
  uiSpecification: Record<string, unknown>;
  teamId: string;
}): Promise<ExistingTemplateDocument> {
  const templatesDb = getTemplatesDb();
  const normalizedUiSpecification =
    normalizeUiSpecificationOrThrow(uiSpecification);
  const now = nowIso();

  try {
    const existing = await getTemplate(id);
    const updated: ExistingTemplateDocument = {
      ...existing,
      name,
      description,
      uiSpecification: normalizedUiSpecification,
      ownedByTeamId: teamId,
      createdBy: SEED_CREATED_BY,
      archived: false,
      isPublic: false,
      version: existing.version + 1,
      updatedAt: now,
    };
    await safeWriteDocument({db: templatesDb, data: updated});
    console.log(`  ✓ Updated template ${name} : ${id}`);
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
      uiSpecification: normalizedUiSpecification,
      ownedByTeamId: teamId,
      name,
      description,
      createdBy: SEED_CREATED_BY,
      createdAt: now,
      updatedAt: now,
    };
    await templatesDb.put(templateDoc);
    console.log(`  ✓ Created template ${name} : ${id}`);
    return await getTemplate(id);
  }
}

async function upsertSeedNotebook({
  id,
  projectName,
  description,
  uiSpecification,
  templateId,
  teamId,
}: {
  id: string;
  projectName: string;
  description?: string;
  uiSpecification: Record<string, unknown>;
  templateId: string;
  teamId: string;
}): Promise<string> {
  const projectsDb = localGetProjectsDb();
  const normalizedUiSpecification =
    normalizeUiSpecificationOrThrow(uiSpecification);
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
      uiSpecification: normalizedUiSpecification,
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
    console.log(`  ✓ Updated notebook ${projectName} : ${id}`);
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
    uiSpecification: normalizedUiSpecification,
  };
  await projectsDb.put(projectDoc);
  await initialiseDataDb({projectId: id, force: true});
  console.log(`  ✓ Created notebook ${projectName} : ${id}`);
  return id;
}

/**
 * Reset a seed persona to the intended baseline (name, verified email, empty
 * resource roles, GENERAL_USER only) before applying UserSpec grants.
 */
function resetSeedUserBaseline(
  user: ExistingPeopleDBDocument | PeopleDBDocument,
  spec: UserSpec
): PeopleDBDocument {
  user.name = spec.name;
  user.disabled = false;
  user.emails = [{email: spec.email.toLowerCase(), verified: true}];
  user.globalRoles = [Role.GENERAL_USER];
  user.teamRoles = [];
  user.projectRoles = [];
  user.templateRoles = [];
  return user;
}

async function upsertSeedUser(
  spec: UserSpec,
  ctx: SeedContext
): Promise<PeopleDBDocument> {
  const existing = await getCouchUserFromEmailOrUserId(spec.email);
  let user: PeopleDBDocument;

  if (existing) {
    user = resetSeedUserBaseline(existing, spec);
    console.log(`  ✓ Updated ${spec.email} (${spec.name})`);
  } else {
    const [created, error] = await createUser({
      email: spec.email,
      name: spec.name,
      verified: true,
    });
    if (!created) {
      throw new Error(`Failed to create user ${spec.email}: ${error}`);
    }
    user = created;
    console.log(`  ✓ Created ${spec.email} (${spec.name})`);
  }

  for (const role of spec.globalRoles ?? []) {
    addGlobalRole({user, role});
  }
  spec.assignResourceRoles?.(user, ctx);

  await saveCouchUser(user);
  await addLocalPasswordForUser(user, SEED_PASSWORD);
  return user;
}

function printSummary(
  ctx: SeedContext,
  users: Array<{user: PeopleDBDocument; spec: UserSpec}>
): void {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                TEST DATASET SEED COMPLETE                  ');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('TEAMS');
  console.log(`  Red Team   : ${ctx.redTeamId}`);
  console.log(`  Blue Team  : ${ctx.blueTeamId}`);

  console.log('\nTEMPLATES');
  console.log(`  Red Template  : ${ctx.redTemplateId}`);
  console.log(`  Blue Template : ${ctx.blueTemplateId}`);

  console.log('\nNOTEBOOKS (surveys)');
  console.log(`  Red Notebook  : ${ctx.redNotebookId}`);
  console.log(`  Blue Notebook : ${ctx.blueNotebookId}`);

  console.log('\nUSERS');
  const header = `  ${'Email'.padEnd(42)} ${'Global Roles'.padEnd(40)} Team Roles`;
  console.log(header);
  console.log('  ' + '─'.repeat(110));

  for (const {user} of users) {
    const email = user.emails[0]?.email ?? user._id;
    const globals = user.globalRoles.join(', ') || '(none)';
    const teams =
      user.teamRoles
        .map(r => `${r.role}@${r.resourceId.replace(/^team_\d+_/, '')}`)
        .join(', ') || '(none)';
    console.log(`  ${email.padEnd(42)} ${globals.padEnd(40)} ${teams}`);
  }

  console.log('\nCREDENTIALS (all seeded users share this password)');
  console.log(`  Password : ${SEED_PASSWORD}`);

  console.log('\nENV VARS FOR E2E TESTS\n');

  for (const user of USER_SPECS) {
    console.log(`TEST_${user.tag}_USERNAME=${user.email}`);
    console.log(`TEST_${user.tag}_PASSWORD=${SEED_PASSWORD}`);
  }

  console.log('');
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────

const main = async () => {
  try {
    // ── Phase 1: Ensure databases / design docs ───────────────────────────────
    console.log(
      'Phase 1: Initialising databases (design docs; data preserved)...'
    );
    await initialiseAndMigrateDBs({force: true, pushKeys: false});
    console.log('✓ Databases initialised');

    // ── Phase 2: Teams ────────────────────────────────────────────────────────
    console.log('\nPhase 2: Upserting teams...');
    const now = Date.now();
    const redTeam = await upsertSeedTeam({
      id: SEED_IDS.redTeam,
      name: 'Red Team',
      description: 'Seed test team Red — exercises manager/member visibility',
      now,
    });
    const blueTeam = await upsertSeedTeam({
      id: SEED_IDS.blueTeam,
      name: 'Blue Team',
      description: 'Seed test team Blue — exercises cross-team visibility',
      now,
    });

    // ── Phase 3: Templates ────────────────────────────────────────────────────
    console.log('\nPhase 3: Upserting templates...');

    const notebookFiles = NOTEBOOK_PATHS.map(loadNotebookJson);
    if (notebookFiles.length < 2) {
      throw new Error(
        `At least 2 notebook files are required (found ${notebookFiles.length}). ` +
          `Set TEST_SEED_NOTEBOOKS to two comma-separated paths.`
      );
    }

    const redTemplateSpec = notebookFiles[0];
    const blueTemplateSpec = notebookFiles[1];

    const redTemplate = await upsertSeedTemplate({
      id: SEED_IDS.redTemplate,
      name: `Red Team Template — ${redTemplateSpec.name}`,
      description: seedDescription(redTemplateSpec.description),
      uiSpecification: redTemplateSpec.uiSpecification,
      teamId: redTeam._id,
    });

    const blueTemplate = await upsertSeedTemplate({
      id: SEED_IDS.blueTemplate,
      name: `Blue Team Template — ${blueTemplateSpec.name}`,
      description: seedDescription(blueTemplateSpec.description),
      uiSpecification: blueTemplateSpec.uiSpecification,
      teamId: blueTeam._id,
    });

    // ── Phase 4: Notebooks ────────────────────────────────────────────────────
    console.log('\nPhase 4: Upserting notebooks...');

    const redNotebookId = await upsertSeedNotebook({
      id: SEED_IDS.redNotebook,
      projectName: `Red Team Notebook — ${redTemplateSpec.name}`,
      uiSpecification: redTemplateSpec.uiSpecification,
      description: seedDescription(redTemplateSpec.description),
      templateId: redTemplate._id,
      teamId: redTeam._id,
    });

    const blueNotebookId = await upsertSeedNotebook({
      id: SEED_IDS.blueNotebook,
      projectName: `Blue Team Notebook — ${blueTemplateSpec.name}`,
      uiSpecification: blueTemplateSpec.uiSpecification,
      description: seedDescription(blueTemplateSpec.description),
      templateId: blueTemplate._id,
      teamId: blueTeam._id,
    });

    const ctx: SeedContext = {
      redTeamId: redTeam._id,
      blueTeamId: blueTeam._id,
      redTemplateId: redTemplate._id,
      blueTemplateId: blueTemplate._id,
      redNotebookId,
      blueNotebookId,
    };

    // ── Phase 5: Users + roles ────────────────────────────────────────────────
    console.log('\nPhase 5: Upserting users and assigning roles...');

    const createdUsers: Array<{user: PeopleDBDocument; spec: UserSpec}> = [];

    for (const spec of USER_SPECS) {
      const user = await upsertSeedUser(spec, ctx);
      createdUsers.push({user, spec});
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    printSummary(ctx, createdUsers);

    process.exit(0);
  } catch (error) {
    console.error('\n✗ Seed failed:', error);
    process.exit(1);
  }
};

main();

// Re-export the Role enum and roleDetails so callers can reference them
// without needing to import from the data-model directly.
export {roleDetails};
