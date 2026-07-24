/**
 * Integration tests for couch-auth-proxy guest/contributor ACL on data DBs.
 *
 * Requires a live stack:
 *   - CouchDB on COUCHDB_INTERNAL_URL (admin)
 *   - couch-auth-proxy on COUCHDB_PUBLIC_URL
 *
 * Skips automatically when the proxy is unreachable so unit CI stays green.
 *
 * Auth uses Couch `_users` + Basic through the proxy with FAIMS-encoded role
 * tokens (`projectId||ROLE`). That matches production JWT `_couchdb.roles`
 * after Couch session resolution.
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

function publicAuthedUrl(name: string, password: string, path = ''): string {
  const u = new URL(PUBLIC_URL);
  u.username = name;
  u.password = password;
  const base = u.toString().replace(/\/$/, '');
  return path ? `${base}/${path.replace(/^\//, '')}` : base;
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
  return new PouchDB(`${publicAuthedUrl(name, password)}/${DATA_DB}`);
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

async function expectForbidden(p: Promise<unknown>): Promise<void> {
  try {
    await p;
    expect.fail('expected write to be forbidden');
  } catch (err: any) {
    const status = err?.status || err?.statusCode || err?.name;
    expect(status).to.be.oneOf([403, 404, 'forbidden', 'not_found']);
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

  const recordId = `rec-${PROJECT_ID}-1`;
  const revId = `frev-${PROJECT_ID}-1`;
  const avpId = `avp-${PROJECT_ID}-1`;

  before(async function () {
    shouldRun = await proxyReady();
    if (!shouldRun) {
      // eslint-disable-next-line no-console
      console.warn(
        `Skipping couch-auth-proxy integration tests (proxy not reachable at ${PUBLIC_URL})`
      );
      this.skip();
    }

    // Fresh DB each run (ignore missing)
    try {
      await new PouchDB(adminDbUrl(DATA_DB)).destroy();
    } catch {
      /* ignore */
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

    const dbA = userDb(guestA, password);
    await waitForAclReady(dbA);

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

    // Attachment on the revision doc (JSON doc + putAttachment path)
    const revDoc = await dbA.get<{_rev: string}>(revId);
    await dbA.putAttachment(
      revId,
      'photo.txt',
      revDoc._rev,
      Buffer.from('private-bytes'),
      'text/plain'
    );
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

  it('isolates guest records from another guest (get / allDocs / changes)', async function () {
    const dbB = userDb(guestB, password);
    await waitForAclReady(dbB);

    await expectNotFound(dbB.get(recordId));
    await expectNotFound(dbB.get(revId));
    await expectNotFound(dbB.get(avpId));

    const bAll = await dbB.allDocs({include_docs: true});
    const bIds = new Set(bAll.rows.map(r => r.id));
    expect(bIds.has(recordId)).to.equal(false);
    expect(bIds.has(revId)).to.equal(false);
    expect(bIds.has(avpId)).to.equal(false);

    // Keyed lists may return placeholders — assert no document body leak
    const keyed = await dbB.allDocs({
      keys: [recordId, revId, avpId],
      include_docs: true,
    });
    for (const row of keyed.rows as Array<{
      id?: string;
      doc?: unknown;
      error?: string;
      value?: {deleted?: boolean};
    }>) {
      expect(row.doc == null || (row as {error?: string}).error).to.satisfy(
        () => row.doc == null || Boolean(row.error)
      );
      if (row.doc) {
        expect.fail('keyed allDocs must not return denied document bodies');
      }
    }

    const changes = await dbB.changes({include_docs: true, since: 0});
    const changeIds = new Set(changes.results.map(r => r.id));
    expect(changeIds.has(recordId)).to.equal(false);
    expect(changeIds.has(revId)).to.equal(false);
    expect(changeIds.has(avpId)).to.equal(false);
  });

  it('denies guest B attachment GET and bulk_get body leak', async function () {
    const auth = Buffer.from(`${guestB}:${password}`).toString('base64');
    const attUrl = `${PUBLIC_URL.replace(/\/$/, '')}/${DATA_DB}/${revId}/photo.txt`;
    const attRes = await fetch(attUrl, {
      headers: {Authorization: `Basic ${auth}`},
    });
    expect(attRes.status).to.be.oneOf([404, 403]);
    const attText = await attRes.text();
    expect(attText).to.not.include('private-bytes');

    const bulkUrl = `${PUBLIC_URL.replace(/\/$/, '')}/${DATA_DB}/_bulk_get`;
    const bulkRes = await fetch(bulkUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({docs: [{id: recordId}, {id: revId}, {id: avpId}]}),
    });
    expect(bulkRes.ok).to.equal(true);
    const bulkJson = (await bulkRes.json()) as {
      results: Array<{
        id: string;
        docs: Array<{
          ok?: {data?: string; created_by?: string};
          error?: unknown;
        }>;
      }>;
    };
    for (const result of bulkJson.results) {
      for (const docEntry of result.docs) {
        if (docEntry.ok) {
          expect.fail(
            `_bulk_get leaked body for ${result.id}: ${JSON.stringify(docEntry.ok)}`
          );
        }
      }
    }
  });

  it('allows contributor read-all and parent inheritance after edit', async function () {
    const dbA = userDb(guestA, password);
    const dbB = userDb(guestB, password);
    const dbC = userDb(contributor, password);
    await waitForAclReady(dbC);

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

  it('denies guest B updating guest A record', async function () {
    const dbB = userDb(guestB, password);
    await waitForAclReady(dbB);
    // Even with a guessed body, B must not update A's record
    await expectForbidden(
      dbB.put({
        _id: recordId,
        _rev: '1-forged',
        record_format_version: 1,
        created: new Date().toISOString(),
        created_by: guestA,
        ...stampRecordAcl(guestA),
        revisions: [revId],
        heads: [revId],
        type: 'FormA',
      })
    );
  });

  it('denies creates without creator (fail-closed VDU)', async function () {
    const dbA = userDb(guestA, password);
    await waitForAclReady(dbA);
    await expectForbidden(
      dbA.put({
        _id: `rec-${PROJECT_ID}-nostamp`,
        record_format_version: 1,
        created: new Date().toISOString(),
        created_by: guestA,
        revisions: [],
        heads: [],
        type: 'FormA',
      })
    );
  });

  it('denies forging creator on create (ACL VDU)', async function () {
    const dbB = userDb(guestB, password);
    await waitForAclReady(dbB);
    await expectForbidden(
      dbB.put({
        _id: `rec-${PROJECT_ID}-forged-creator`,
        record_format_version: 1,
        created: new Date().toISOString(),
        created_by: guestA,
        ...stampRecordAcl(guestA),
        revisions: [],
        heads: [],
        type: 'FormA',
      })
    );
  });

  it('allows guests to read sync design docs (attachment_filter)', async function () {
    const dbB = userDb(guestB, password);
    await waitForAclReady(dbB);
    const ddoc = await dbB.get('_design/attachment_filter');
    expect(ddoc._id).to.equal('_design/attachment_filter');
  });

  it('admin internal URL still sees all records (API bypass)', async function () {
    const adminData = new PouchDB(adminDbUrl(DATA_DB));
    const rec = await adminData.get(recordId);
    expect((rec as {_id: string})._id).to.equal(recordId);
    const all = await adminData.allDocs({include_docs: false});
    const ids = new Set(all.rows.map(r => r.id));
    expect(ids.has(recordId)).to.equal(true);
    expect(ids.has(revId)).to.equal(true);
  });
});
