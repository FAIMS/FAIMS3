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
  buildDbAclOverlay,
  DbAclOverlay,
  ensureDataDbAclOverlay,
  projectIdFromDataDbName,
  stampChildAcl,
  stampDataDocumentAclFields,
  stampRecordAcl,
  toProxyRoleGrant,
} from '../src/data_storage/dataDB/acl';
import {
  FAIMS_ACL_SHAPE_DDOC_ID,
  FAIMS_ACL_SHAPE_DDOC_VERSION,
  FAIMS_ACL_SHAPE_VALIDATE_DOC_UPDATE_SOURCE,
  buildFaimsAclShapeDesignDoc,
} from '../src/data_storage/dataDB/faimsAclShape';
import {dataV1toV2Migration, initDataDB} from '../src/data_storage';

PouchDB.plugin(PouchDBMemoryAdapter);

/** Minimal stand-in for a proxy-installed `_design/acl` (map/validate_doc_update omitted). */
async function seedProxyAclStub(
  db: PouchDB.Database,
  dbacl?: DbAclOverlay
): Promise<void> {
  await db.put({
    _id: '_design/acl',
    language: 'javascript',
    type: 'ddoc',
    version: '2.3.0',
    acl: [],
    ...(dbacl ? {dbacl} : {}),
    views: {acl: {map: 'function (doc) { emit(doc._id, {}); }'}},
    validate_doc_update: 'function () {}',
  });
}

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

    expect(overlay._r).toEqual(
      necessaryActionToCouchRoleList({
        action: Action.READ_ALL_PROJECT_RECORDS,
        resourceId: projectId,
      }).map(toProxyRoleGrant)
    );
  });

  test('FAIMS shape validate_doc_update requires child parent only; require-creator is proxy env', () => {
    expect(FAIMS_ACL_SHAPE_VALIDATE_DOC_UPDATE_SOURCE).not.toContain(
      'Document must have a creator'
    );
    expect(FAIMS_ACL_SHAPE_VALIDATE_DOC_UPDATE_SOURCE).toContain(
      'Child document parent must equal record_id'
    );
    const shape = buildFaimsAclShapeDesignDoc();
    expect(shape._id).toBe(FAIMS_ACL_SHAPE_DDOC_ID);
    expect(shape.version).toBe(FAIMS_ACL_SHAPE_DDOC_VERSION);
    expect(shape.validate_doc_update).toBe(
      FAIMS_ACL_SHAPE_VALIDATE_DOC_UPDATE_SOURCE
    );
  });

  test('stampDataDocumentAclFields stamps records, children, and orphans', () => {
    expect(
      stampDataDocumentAclFields({
        _id: 'rec-1',
        created_by: 'alice',
        record_format_version: 1,
      })
    ).toEqual(expect.objectContaining({_id: 'rec-1', creator: 'alice'}));
    expect(
      stampDataDocumentAclFields({
        _id: 'frev-1',
        record_id: 'rec-1',
        created_by: 'bob',
      })
    ).toEqual(
      expect.objectContaining({
        creator: 'bob',
        parent: 'rec-1',
      })
    );
    expect(
      stampDataDocumentAclFields({
        _id: 'rec-orphan',
        record_format_version: 1,
      })
    ).toEqual(expect.objectContaining({creator: ACL_ORPHAN_CREATOR}));
    expect(
      stampDataDocumentAclFields({
        _id: 'frev-ok',
        record_id: 'rec-1',
        created_by: 'bob',
        creator: 'bob',
        parent: 'rec-1',
      })
    ).toBeNull();
  });

  test('initDataDB includes faims_acl_shape but not proxy _design/acl', () => {
    const init = initDataDB({projectId});
    expect(
      init.designDocuments.find(d => d._id === '_design/acl')
    ).toBeUndefined();
    const shapeDoc = init.designDocuments.find(
      d => d._id === FAIMS_ACL_SHAPE_DDOC_ID
    );
    expect(shapeDoc).toBeDefined();
    expect(
      (shapeDoc as {validate_doc_update?: string}).validate_doc_update
    ).toContain('Child document parent must equal record_id');
    expect(
      (shapeDoc as {validate_doc_update?: string}).validate_doc_update
    ).not.toContain('Document must have a creator');
    expect(
      init.designDocuments.find(d => d._id === '_design/permissions')
    ).toBeDefined();
  });

  test('projectIdFromDataDbName parses data- prefix and remote URLs', () => {
    expect(projectIdFromDataDbName('data-abc')).toBe('abc');
    expect(projectIdFromDataDbName('people')).toBeUndefined();
    expect(projectIdFromDataDbName('data-')).toBeUndefined();
    expect(projectIdFromDataDbName('http://localhost:5984/data-abc')).toBe(
      'abc'
    );
    expect(projectIdFromDataDbName('http://couchdb:5984/data-abc/')).toBe(
      'abc'
    );
    expect(
      projectIdFromDataDbName('http://localhost:5984/people')
    ).toBeUndefined();
  });

  test('ensureDataDbAclOverlay is idempotent when dbacl unchanged', async () => {
    const db = new PouchDB(`acl-ensure-${Date.now()}`, {adapter: 'memory'});
    await seedProxyAclStub(db, buildDbAclOverlay(projectId));
    const firstResult = await ensureDataDbAclOverlay({
      db: db as any,
      projectId,
    });
    expect(firstResult.status).toBe('unchanged');
    const first = await db.get<{dbacl: {_r: string[]}; _rev: string}>(
      '_design/acl'
    );
    const shapeFirst = await db.get<{_rev: string}>(FAIMS_ACL_SHAPE_DDOC_ID);
    const secondResult = await ensureDataDbAclOverlay({
      db: db as any,
      projectId,
    });
    expect(secondResult.status).toBe('unchanged');
    const second = await db.get<{_rev: string}>('_design/acl');
    expect(second._rev).toBe(first._rev);
    const shapeSecond = await db.get<{_rev: string}>(FAIMS_ACL_SHAPE_DDOC_ID);
    expect(shapeSecond._rev).toBe(shapeFirst._rev);
    await db.destroy();
  });

  test('ensureDataDbAclOverlay patches mismatched dbacl without rewriting map', async () => {
    const db = new PouchDB(`acl-repair-${Date.now()}`, {adapter: 'memory'});
    await seedProxyAclStub(db, {
      _r: ['r-stale'],
      _w: ['r-stale'],
      _d: ['r-stale'],
    });
    const before = await db.get<{
      dbacl: DbAclOverlay;
      _rev: string;
      views: {acl: {map: string}};
      validate_doc_update: string;
      version: string;
    }>('_design/acl');
    const result = await ensureDataDbAclOverlay({db: db as any, projectId});
    expect(result.status).toBe('updated');
    const repaired = await db.get<{
      dbacl: DbAclOverlay;
      _rev: string;
      views: {acl: {map: string}};
      validate_doc_update: string;
      version: string;
    }>('_design/acl');
    expect(repaired.dbacl).toEqual(buildDbAclOverlay(projectId));
    expect(repaired._rev).not.toBe(before._rev);
    expect(repaired.views.acl.map).toBe(before.views.acl.map);
    expect(repaired.validate_doc_update).toBe(before.validate_doc_update);
    expect(repaired.version).toBe(before.version);
    await db.destroy();
  });

  test('ensureDataDbAclOverlay reports missing_proxy_ddoc without inventing map', async () => {
    const db = new PouchDB(`acl-missing-${Date.now()}`, {adapter: 'memory'});
    const result = await ensureDataDbAclOverlay({db: db as any, projectId});
    expect(result.status).toBe('missing_proxy_ddoc');
    await expect(db.get('_design/acl')).rejects.toBeTruthy();
    await db.get(FAIMS_ACL_SHAPE_DDOC_ID);
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
