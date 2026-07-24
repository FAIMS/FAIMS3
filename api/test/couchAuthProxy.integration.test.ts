/**
 * Integration tests for couch-auth-proxy guest/contributor ACL on data DBs.
 *
 * Requires a live stack:
 *   - CouchDB on COUCHDB_INTERNAL_URL (admin)
 *   - couch-auth-proxy on COUCHDB_PUBLIC_URL
 *
 * Skips automatically when the proxy is unreachable so unit CI stays green.
 *
 * Run (stack up):
 *   pnpm --filter=@faims3/api run test:couch-auth-proxy
 */
import {expect} from 'chai';
import PouchDB from 'pouchdb';
import {
  couchInitialiser,
  encodeClaim,
  initDataDB,
  Role,
  stampChildAcl,
  stampRecordAcl,
} from '@faims3/data-model';

const INTERNAL_URL =
  process.env.COUCHDB_INTERNAL_URL ?? 'http://localhost:5984';
const PUBLIC_URL = process.env.COUCHDB_PUBLIC_URL ?? 'http://localhost:5985';
const COUCH_USER = process.env.COUCHDB_USER ?? 'admin';
const COUCH_PASSWORD =
  process.env.COUCHDB_PASSWORD ?? 'aSecretPasswordThatCantBeGuessed';

const PROJECT_ID = `acl-it-${Date.now()}`;
const DATA_DB = `data-${PROJECT_ID}`;

async function proxyReady(): Promise<boolean> {
  try {
    const res = await fetch(`${PUBLIC_URL}/_couch-auth-proxy/health`);
    return res.ok;
  } catch {
    return false;
  }
}

function adminDbUrl(dbName: string): string {
  const u = new URL(INTERNAL_URL);
  u.username = COUCH_USER;
  u.password = COUCH_PASSWORD;
  return `${u.toString().replace(/\/$/, '')}/${dbName}`;
}

async function ensureCouchUser(args: {
  name: string;
  password: string;
  roles: string[];
}): Promise<void> {
  const usersDb = new PouchDB(adminDbUrl('_users'));
  const id = `org.couchdb.user:${args.name}`;
  const doc = {
    _id: id,
    name: args.name,
    password: args.password,
    roles: args.roles,
    type: 'user',
  };
  try {
    const existing = await usersDb.get(id);
    await usersDb.put({...doc, _rev: (existing as {_rev: string})._rev});
  } catch {
    await usersDb.put(doc);
  }
}

function userDb(name: string, password: string): PouchDB.Database {
  const u = new URL(PUBLIC_URL);
  u.username = name;
  u.password = password;
  return new PouchDB(`${u.toString().replace(/\/$/, '')}/${DATA_DB}`);
}

async function expectNotFound(p: Promise<unknown>): Promise<void> {
  try {
    await p;
    expect.fail('expected document access to fail');
  } catch (err: any) {
    const status = err?.status || err?.statusCode || err?.name;
    // Proxy may briefly return 503 while the ACL follower starts; treat other
    // denials as isolation success.
    expect(status).to.be.oneOf([404, 403, 'not_found', 'forbidden']);
  }
}

/** Warm the proxy ACL cache / follower until a non-admin GET succeeds or 404s. */
async function waitForAclReady(db: PouchDB.Database): Promise<void> {
  const deadline = Date.now() + 30000;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    try {
      await db.info();
      return;
    } catch (err: any) {
      lastErr = err;
      const msg = String(err?.message || err);
      if (!msg.includes('ACL cache unavailable') && err?.status !== 503) {
        // info() itself can 404 for non-members; any non-503 means follower up
        if (err?.status === 404 || err?.status === 403) return;
        throw err;
      }
      await new Promise(r => setTimeout(r, 500));
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(`ACL cache not ready: ${String(lastErr)}`);
}

describe('couch-auth-proxy data DB ACL', function () {
  this.timeout(90000);

  let shouldRun = false;
  const guestA = `guest-a-${PROJECT_ID}`;
  const guestB = `guest-b-${PROJECT_ID}`;
  const contributor = `contrib-${PROJECT_ID}`;
  const password = 'test-pass-acl';

  const guestRole = encodeClaim({
    resourceId: PROJECT_ID,
    claim: Role.PROJECT_GUEST,
  });
  const contributorRole = encodeClaim({
    resourceId: PROJECT_ID,
    claim: Role.PROJECT_CONTRIBUTOR,
  });

  before(async function () {
    shouldRun = await proxyReady();
    if (!shouldRun) {
      // eslint-disable-next-line no-console
      console.warn(
        `Skipping couch-auth-proxy integration tests (proxy not reachable at ${PUBLIC_URL})`
      );
      this.skip();
    }

    const adminData = new PouchDB(adminDbUrl(DATA_DB));
    await couchInitialiser({
      db: adminData as any,
      content: initDataDB({projectId: PROJECT_ID}),
      config: {applyPermissions: true, forceWrite: true},
    });

    await ensureCouchUser({
      name: guestA,
      password,
      roles: [guestRole],
    });
    await ensureCouchUser({
      name: guestB,
      password,
      roles: [guestRole],
    });
    await ensureCouchUser({
      name: contributor,
      password,
      roles: [contributorRole],
    });
  });

  after(async function () {
    if (!shouldRun) return;
    try {
      const adminData = new PouchDB(adminDbUrl(DATA_DB));
      await adminData.destroy();
    } catch {
      /* ignore */
    }
  });

  it('isolates guest records and allows contributor + parent inheritance', async function () {
    const dbA = userDb(guestA, password);
    const dbB = userDb(guestB, password);
    const dbC = userDb(contributor, password);

    await waitForAclReady(dbA);

    const recordId = `rec-${PROJECT_ID}-1`;
    const revId = `frev-${PROJECT_ID}-1`;
    const avpId = `avp-${PROJECT_ID}-1`;

    await dbA.put({
      _id: recordId,
      record_format_version: 1,
      created: new Date().toISOString(),
      created_by: guestA,
      ...stampRecordAcl(guestA),
      revisions: [revId],
      heads: [revId],
      type: 'FormA',
    });
    await dbA.put({
      _id: revId,
      revision_format_version: 1,
      avps: {field1: avpId},
      record_id: recordId,
      parents: [],
      created: new Date().toISOString(),
      created_by: guestA,
      ...stampChildAcl({createdBy: guestA, recordId}),
      type: 'FormA',
    });
    await dbA.put({
      _id: avpId,
      avp_format_version: 1,
      type: 'faims-core::String',
      data: 'secret-from-a',
      revision_id: revId,
      record_id: recordId,
      created: new Date().toISOString(),
      created_by: guestA,
      ...stampChildAcl({createdBy: guestA, recordId}),
    });

    await expectNotFound(dbB.get(recordId));
    await expectNotFound(dbB.get(revId));
    await expectNotFound(dbB.get(avpId));

    const bAll = await dbB.allDocs({include_docs: true});
    const bIds = new Set(bAll.rows.map(r => r.id));
    expect(bIds.has(recordId)).to.equal(false);
    expect(bIds.has(revId)).to.equal(false);

    const cRec = (await dbC.get(recordId)) as unknown as {
      created_by: string;
    };
    expect(cRec.created_by).to.equal(guestA);

    const contribRev = `frev-${PROJECT_ID}-contrib`;
    await dbC.put({
      _id: contribRev,
      revision_format_version: 1,
      avps: {field1: avpId},
      record_id: recordId,
      parents: [revId],
      created: new Date().toISOString(),
      created_by: contributor,
      ...stampChildAcl({createdBy: contributor, recordId}),
      type: 'FormA',
    });

    const aSeesContrib = (await dbA.get(contribRev)) as unknown as {
      created_by: string;
      parent: string;
    };
    expect(aSeesContrib.created_by).to.equal(contributor);
    expect(aSeesContrib.parent).to.equal(recordId);

    await expectNotFound(dbB.get(contribRev));
  });
});
