/* eslint-disable n/no-process-exit */
/**
 * Seed DASS load-test accounts (users only — no DB init or migrations).
 *
 * Creates or updates N local-auth users with PROJECT_CONTRIBUTOR on a given
 * notebook project. Does NOT call initialiseAndMigrateDBs or migrate.
 *
 * Usage (from api/):
 *   env-cmd ts-node src/scripts/seedLoadTestAccounts.ts
 *
 * Environment:
 *   COUCHDB_*           — same as API (see api/.env.dist)
 *   LOAD_TEST_PROJECT_ID  — notebook project id agents activate (required)
 *   LOAD_TEST_SEED_COUNT  — number of accounts (default 10, min 1, max 50)
 *   LOAD_TEST_SEED_PASSWORD — shared password (default LoadTestPass123!)
 *   LOAD_TEST_EMAIL_PREFIX  — default loadtest
 *   LOAD_TEST_EMAIL_DOMAIN  — default faims.test
 */

import {addProjectRole, PeopleDBDocument, Role} from '@faims3/data-model';
import {addLocalPasswordForUser} from '../auth/helpers';
import {getUsersDB} from '../couchdb';
import {
  createUser,
  getCouchUserFromEmailOrUserId,
  saveCouchUser,
} from '../couchdb/users';

const SEED_COUNT = Math.min(
  50,
  Math.max(1, parseInt(process.env.LOAD_TEST_SEED_COUNT ?? '10', 10) || 10)
);
const SEED_PASSWORD = process.env.LOAD_TEST_SEED_PASSWORD ?? 'LoadTestPass123!';
const PROJECT_ID = process.env.LOAD_TEST_PROJECT_ID?.trim();
const EMAIL_PREFIX = process.env.LOAD_TEST_EMAIL_PREFIX?.trim() || 'loadtest';
const EMAIL_DOMAIN = process.env.LOAD_TEST_EMAIL_DOMAIN?.trim() || 'faims.test';
const ACCOUNT_SEPARATOR = '::';

function accountEmail(index: number): string {
  return `${EMAIL_PREFIX}-${index}@${EMAIL_DOMAIN}`;
}

/** Verify CouchDB is reachable; never run schema migrations from this script. */
async function assertPeopleDbReachable(): Promise<void> {
  const db = getUsersDB();
  try {
    await db.info();
  } catch (err) {
    console.error(
      'Cannot reach the CouchDB people database with the current COUCHDB_* settings.'
    );
    console.error(
      'This script only creates/updates load-test users — it does not initialise or migrate databases.'
    );
    console.error(
      'Point .env at the correct environment and ensure CouchDB is already running.'
    );
    console.error((err as Error).message);
    process.exit(1);
  }
}

async function ensureContributorUser(
  email: string,
  name: string,
  projectId: string
): Promise<PeopleDBDocument> {
  const existing = await getCouchUserFromEmailOrUserId(email);
  if (existing) {
    const hasRole = existing.projectRoles.some(
      r => r.resourceId === projectId && r.role === Role.PROJECT_CONTRIBUTOR
    );
    if (!hasRole) {
      addProjectRole({
        user: existing,
        role: Role.PROJECT_CONTRIBUTOR,
        projectId,
      });
      await saveCouchUser(existing);
    }
    await addLocalPasswordForUser(existing, SEED_PASSWORD);
    return existing;
  }

  const [user, error] = await createUser({
    email,
    name,
    verified: true,
  });
  if (!user) {
    throw new Error(`Failed to create ${email}: ${error}`);
  }

  addProjectRole({
    user,
    role: Role.PROJECT_CONTRIBUTOR,
    projectId,
  });
  await saveCouchUser(user);
  await addLocalPasswordForUser(user, SEED_PASSWORD);
  return user;
}

const main = async () => {
  if (!PROJECT_ID) {
    console.error('LOAD_TEST_PROJECT_ID is required (notebook project id).');
    process.exit(1);
  }

  await assertPeopleDbReachable();

  console.log(
    `Creating ${SEED_COUNT} load-test user(s) with PROJECT_CONTRIBUTOR on ${PROJECT_ID}…`
  );

  const emails: string[] = [];
  for (let i = 1; i <= SEED_COUNT; i += 1) {
    const email = accountEmail(i);
    const name = `Load Test User ${i}`;
    await ensureContributorUser(email, name, PROJECT_ID);
    emails.push(email);
    console.log(`  ✓ ${email}`);
  }

  const accountsLine = emails
    .map(email => `${email}${ACCOUNT_SEPARATOR}${SEED_PASSWORD}`)
    .join(',');

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('           LOAD TEST ACCOUNTS SEED COMPLETE');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`Project id : ${PROJECT_ID}`);
  console.log(`Password   : ${SEED_PASSWORD}`);
  console.log(`Accounts   : ${emails.length}`);
  console.log('\nAdd to load-testing/coordinator/.env and scripts/.env:\n');
  console.log(
    '# Use :: between email and password (unquoted || breaks bash .env sourcing)'
  );
  console.log(`LOAD_TEST_ACCOUNTS=${accountsLine}`);
  console.log('');
  console.log(
    'Tip: use at most one agent per account (AGENT_COUNT ≤ account count) for isolated sessions.'
  );
  console.log('');

  process.exit(0);
};

main().catch(err => {
  console.error('\n✗ Seed failed:', err);
  process.exit(1);
});
