/* eslint-disable n/no-process-exit */
/**
 * seedTestDataset.ts
 *
 * Destructive test-data seed script.
 *
 * Creates a deterministic, permission-testing dataset in the configured
 * CouchDB instance.  The script:
 *
 *   1. Re-initialises all databases (force=true) so every run starts clean.
 *   2. Creates two teams: Red Team and Blue Team.
 *   3. Creates one template and one notebook (survey) owned by each team,
 *      sourced from the JSON files under api/notebooks/.
 *   4. Creates a set of deterministic users that collectively cover every
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
 *                        Defaults to "./notebooks/Field-Sampler.json,
 *                        ./notebooks/sample_notebook.json"
 *
 * WARNING: This is a destructive operation.  All existing data in the
 * configured CouchDB will be wiped and replaced with seed data.
 */

import {
  addGlobalRole,
  addProjectRole,
  addTeamRole,
  PeopleDBDocument,
  Role,
  roleDetails,
  ROOT_DESCRIPTION_MAX_LENGTH,
} from '@faims3/data-model';
import {readFileSync} from 'fs';
import {addLocalPasswordForUser} from '../auth/helpers';
import {initialiseAndMigrateDBs} from '../couchdb';
import {createNotebook} from '../couchdb/notebooks';
import {createTeamDocument} from '../couchdb/teams';
import {createTemplate} from '../couchdb/templates';
import {createUser, saveCouchUser} from '../couchdb/users';

// ──────────────────────────────────────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────────────────────────────────────

const SEED_PASSWORD = process.env.TEST_SEED_PASSWORD || 'TestPassword123!';

const DEFAULT_NOTEBOOK_PATHS = [
  './notebooks/Field-Sampler.json',
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
    // no resource roles, purely admin role
    assignResourceRoles() {},
  },

  // ── seed-manager-cross ────────────────────────────────────────────────────
  // TEAM_MANAGER on Blue
  // Exercises visibility differences across teams for the same user.
  {
    email: 'seed-manager-blue@faims.test',
    tag: 'MANAGER_BLUE',
    name: 'Blue Team Manager',
    assignResourceRoles(user, ctx) {
      addTeamRole({user, role: Role.TEAM_MANAGER, teamId: ctx.blueTeamId});
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
    // ── Phase 1: Reset/init databases ────────────────────────────────────────
    console.log('Phase 1: Initialising databases (force reset)...');
    await initialiseAndMigrateDBs({force: true, pushKeys: false});
    console.log('✓ Databases initialised');

    // ── Phase 2: Teams ────────────────────────────────────────────────────────
    console.log('\nPhase 2: Creating teams...');
    const now = Date.now();
    const seedBot = 'seed-script';
    const redTeam = await createTeamDocument({
      name: 'Red Team',
      description: 'Seed test team Red — exercises manager/member visibility',
      createdAt: now,
      updatedAt: now,
      createdBy: seedBot,
    });
    const blueTeam = await createTeamDocument({
      name: 'Blue Team',
      description: 'Seed test team Blue — exercises cross-team visibility',
      createdAt: now,
      updatedAt: now,
      createdBy: seedBot,
    });
    console.log(`✓ Created Red Team  : ${redTeam._id}`);
    console.log(`✓ Created Blue Team : ${blueTeam._id}`);

    // ── Phase 3: Templates ────────────────────────────────────────────────────
    console.log('\nPhase 3: Creating templates...');

    const notebookFiles = NOTEBOOK_PATHS.map(loadNotebookJson);
    if (notebookFiles.length < 2) {
      throw new Error(
        `At least 2 notebook files are required (found ${notebookFiles.length}). ` +
          `Set TEST_SEED_NOTEBOOKS to two comma-separated paths.`
      );
    }

    const redTemplateSpec = notebookFiles[0];
    const blueTemplateSpec = notebookFiles[1];

    const redTemplate = await createTemplate({
      createdBy: seedBot,
      payload: {
        name: `Red Team Template — ${redTemplateSpec.name}`,
        description: clampDescription(redTemplateSpec.description),
        uiSpecification: redTemplateSpec.uiSpecification,
        teamId: redTeam._id,
      },
    });

    const blueTemplate = await createTemplate({
      createdBy: seedBot,
      payload: {
        name: `Blue Team Template — ${blueTemplateSpec.name}`,
        description: clampDescription(blueTemplateSpec.description),
        uiSpecification: blueTemplateSpec.uiSpecification,
        teamId: blueTeam._id,
      },
    });

    console.log(`✓ Created Red Template  : ${redTemplate._id}`);
    console.log(`✓ Created Blue Template : ${blueTemplate._id}`);

    // ── Phase 4: Notebooks ────────────────────────────────────────────────────
    console.log('\nPhase 4: Creating notebooks...');

    const redNotebookId = await createNotebook({
      projectName: `Red Team Notebook — ${redTemplateSpec.name}`,
      uiSpecification: redTemplateSpec.uiSpecification as never,
      description: clampDescription(redTemplateSpec.description),
      templateId: redTemplate._id,
      teamId: redTeam._id,
      createdBy: seedBot,
    });

    const blueNotebookId = await createNotebook({
      projectName: `Blue Team Notebook — ${blueTemplateSpec.name}`,
      uiSpecification: blueTemplateSpec.uiSpecification as never,
      description: clampDescription(blueTemplateSpec.description),
      templateId: blueTemplate._id,
      teamId: blueTeam._id,
      createdBy: seedBot,
    });

    if (!redNotebookId || !blueNotebookId) {
      throw new Error('Failed to create one or more notebooks');
    }

    console.log(`✓ Created Red Notebook  : ${redNotebookId}`);
    console.log(`✓ Created Blue Notebook : ${blueNotebookId}`);

    const ctx: SeedContext = {
      redTeamId: redTeam._id,
      blueTeamId: blueTeam._id,
      redTemplateId: redTemplate._id,
      blueTemplateId: blueTemplate._id,
      redNotebookId,
      blueNotebookId,
    };

    // ── Phase 5: Users + roles ────────────────────────────────────────────────
    console.log('\nPhase 5: Creating users and assigning roles...');

    const createdUsers: Array<{user: PeopleDBDocument; spec: UserSpec}> = [];

    for (const spec of USER_SPECS) {
      const [user, error] = await createUser({
        email: spec.email,
        name: spec.name,
        verified: true,
      });

      if (!user) {
        throw new Error(`Failed to create user ${spec.email}: ${error}`);
      }

      // Assign additional global roles
      for (const role of spec.globalRoles ?? []) {
        addGlobalRole({user, role});
      }

      // Assign resource-scoped roles
      spec.assignResourceRoles?.(user, ctx);

      // Persist user (without password first so the doc exists)
      await saveCouchUser(user);

      // Set shared local password — this re-saves the document internally
      await addLocalPasswordForUser(user, SEED_PASSWORD);

      createdUsers.push({user, spec});
      console.log(`  ✓ ${spec.email} (${spec.name})`);
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
