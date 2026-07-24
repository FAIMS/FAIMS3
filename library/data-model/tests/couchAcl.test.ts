import PouchDB from 'pouchdb';
import PouchDBMemoryAdapter from 'pouchdb-adapter-memory';
import {
  Action,
  COUCH_ADMIN_ROLE_NAME,
  Role,
  encodeClaim,
  necessaryActionToCouchRoleList,
} from '../src';
import {
  ACL_ORPHAN_CREATOR,
  buildDataDbAclDesignDoc,
  buildDbAclOverlay,
  COUCH_AUTH_PROXY_ACL_DDOC_VERSION,
  DbAclOverlay,
  ensureDataDbAclDesignDoc,
  projectIdFromDataDbName,
  stampChildAcl,
  stampRecordAcl,
  toProxyRoleGrant,
} from '../src/data_storage/dataDB/acl';
import {dataV1toV2Migration, initDataDB} from '../src/data_storage';

PouchDB.plugin(PouchDBMemoryAdapter);

describe('couch-auth-proxy ACL helpers', () => {
  const projectId = 'proj-acl-test';

  test('stampRecordAcl sets creator from createdBy', () => {
    expect(stampRecordAcl('alice')).toEqual({creator: 'alice'});
  });

  test('stampChildAcl sets creator and parent record id', () => {
    expect(stampChildAcl({createdBy: 'bob', recordId: 'rec-123'})).toEqual({
      creator: 'bob',
      parent: 'rec-123',
    });
  });

  test('toProxyRoleGrant prefixes roles with r-', () => {
    expect(toProxyRoleGrant('writers')).toBe('r-writers');
    expect(toProxyRoleGrant('r-writers')).toBe('r-writers');
    expect(toProxyRoleGrant('u-alice')).toBe('u-alice');
    expect(toProxyRoleGrant(COUCH_ADMIN_ROLE_NAME)).toBe(
      `r-${COUCH_ADMIN_ROLE_NAME}`
    );
  });

  test('buildDbAclOverlay excludes guest my-only tokens and includes contributor+', () => {
    const overlay = buildDbAclOverlay(projectId);
    const guestToken = toProxyRoleGrant(
      encodeClaim({resourceId: projectId, claim: Role.PROJECT_GUEST})
    );
    const contributorToken = toProxyRoleGrant(
      encodeClaim({resourceId: projectId, claim: Role.PROJECT_CONTRIBUTOR})
    );
    const adminToken = toProxyRoleGrant(COUCH_ADMIN_ROLE_NAME);

    for (const list of [overlay._r, overlay._w, overlay._d]) {
      expect(list).not.toContain(guestToken);
      expect(list).toContain(contributorToken);
      expect(list).toContain(adminToken);
    }

    // Align with permission helper source lists (plus r- prefix)
    expect(overlay._r).toEqual(
      necessaryActionToCouchRoleList({
        action: Action.READ_ALL_PROJECT_RECORDS,
        resourceId: projectId,
      }).map(toProxyRoleGrant)
    );
  });

  test('buildDataDbAclDesignDoc matches upstream version and carries dbacl', () => {
    const ddoc = buildDataDbAclDesignDoc(projectId);
    expect(ddoc._id).toBe('_design/acl');
    expect(ddoc.version).toBe(COUCH_AUTH_PROXY_ACL_DDOC_VERSION);
    expect(ddoc.acl).toEqual([]);
    expect(ddoc.dbacl).toEqual(buildDbAclOverlay(projectId));
    expect(ddoc.views.acl.map).toContain('emit(doc._id');
    expect(ddoc.validate_doc_update).toContain('Creator can not be changed');
  });

  test('initDataDB includes _design/acl with project dbacl', () => {
    const init = initDataDB({projectId});
    const aclDoc = init.designDocuments.find(d => d._id === '_design/acl');
    expect(aclDoc).toBeDefined();
    expect((aclDoc as {dbacl: unknown}).dbacl).toEqual(
      buildDbAclOverlay(projectId)
    );
  });

  test('projectIdFromDataDbName parses data- prefix', () => {
    expect(projectIdFromDataDbName('data-abc')).toBe('abc');
    expect(projectIdFromDataDbName('people')).toBeUndefined();
    expect(projectIdFromDataDbName('data-')).toBeUndefined();
  });

  test('ensureDataDbAclDesignDoc is idempotent when unchanged', async () => {
    const db = new PouchDB(`acl-ensure-${Date.now()}`, {adapter: 'memory'});
    await ensureDataDbAclDesignDoc({db: db as any, projectId});
    const first = await db.get<{dbacl: {_r: string[]}; _rev: string}>(
      '_design/acl'
    );
    expect(first.dbacl._r.length).toBeGreaterThan(0);
    await ensureDataDbAclDesignDoc({db: db as any, projectId});
    const second = await db.get<{_rev: string}>('_design/acl');
    expect(second._rev).toBe(first._rev);
    await db.destroy();
  });

  test('ensureDataDbAclDesignDoc repairs mismatched dbacl', async () => {
    const db = new PouchDB(`acl-repair-${Date.now()}`, {adapter: 'memory'});
    await ensureDataDbAclDesignDoc({db: db as any, projectId});
    const first = await db.get<{dbacl: DbAclOverlay; _rev: string}>(
      '_design/acl'
    );
    await db.put({
      ...first,
      dbacl: {_r: ['r-stale'], _w: ['r-stale'], _d: ['r-stale']},
    });
    await ensureDataDbAclDesignDoc({db: db as any, projectId});
    const repaired = await db.get<{dbacl: {_r: string[]}; _rev: string}>(
      '_design/acl'
    );
    expect(repaired.dbacl).toEqual(buildDbAclOverlay(projectId));
    expect(repaired._rev).not.toBe(first._rev);
    await db.destroy();
  });
});

describe('dataV1toV2Migration', () => {
  test('stamps unstamped record', async () => {
    const result = await dataV1toV2Migration({
      _id: 'rec-1',
      _rev: '1-abc',
      record_format_version: 1,
      created_by: 'alice',
      created: new Date().toISOString(),
      revisions: [],
      heads: [],
      type: 'FormA',
    });
    expect(result.action).toBe('update');
    if (result.action === 'update') {
      expect(result.updatedRecord.creator).toBe('alice');
    }
  });

  test('stamps unstamped child and repairs parent', async () => {
    const result = await dataV1toV2Migration({
      _id: 'frev-1',
      _rev: '1-abc',
      revision_format_version: 1,
      record_id: 'rec-1',
      created_by: 'bob',
      parents: [],
      avps: {},
      type: 'FormA',
      created: new Date().toISOString(),
    });
    expect(result.action).toBe('update');
    if (result.action === 'update') {
      expect(result.updatedRecord.creator).toBe('bob');
      expect(result.updatedRecord.parent).toBe('rec-1');
    }
  });

  test('idempotent when already stamped', async () => {
    const result = await dataV1toV2Migration({
      _id: 'frev-2',
      _rev: '1-abc',
      revision_format_version: 1,
      record_id: 'rec-1',
      created_by: 'bob',
      creator: 'bob',
      parent: 'rec-1',
      parents: [],
      avps: {},
      type: 'FormA',
      created: new Date().toISOString(),
    });
    expect(result.action).toBe('none');
  });

  test('repairs wrong parent', async () => {
    const result = await dataV1toV2Migration({
      _id: 'avp-1',
      _rev: '1-abc',
      avp_format_version: 1,
      record_id: 'rec-9',
      created_by: 'carol',
      creator: 'carol',
      parent: 'rec-wrong',
      type: 'faims-core::String',
      data: 'x',
      revision_id: 'frev-1',
      created: new Date().toISOString(),
    });
    expect(result.action).toBe('update');
    if (result.action === 'update') {
      expect(result.updatedRecord.parent).toBe('rec-9');
      expect(result.updatedRecord.creator).toBe('carol');
    }
  });

  test('fail-closed orphan creator when created_by missing', async () => {
    const result = await dataV1toV2Migration({
      _id: 'rec-orphan',
      _rev: '1-abc',
      record_format_version: 1,
      created: new Date().toISOString(),
      revisions: [],
      heads: [],
      type: 'FormA',
    });
    expect(result.action).toBe('update');
    if (result.action === 'update') {
      expect(result.updatedRecord.creator).toBe(ACL_ORPHAN_CREATOR);
    }
  });
});
