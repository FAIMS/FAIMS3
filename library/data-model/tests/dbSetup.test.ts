// SPDX-License-Identifier: Apache-2.0
import PouchDB from 'pouchdb';
import PouchDBMemoryAdapter from 'pouchdb-adapter-memory';
import {
  applyVersionedInitialisation,
  contentForSetupType,
  DB_SETUP_DOC_KIND,
  DB_SETUP_TYPES,
  DB_SETUP_VERSIONS,
  dbSetupDocId,
  decideSetupAction,
  hashDesignDocuments,
  hashSecurityDocument,
  isDbSetupDoc,
  readDbSetupDoc,
  unregisterDbSetupDoc,
  type DbSetupDoc,
  type DbSetupEvent,
  type DbSetupStore,
  type InitialisationContent,
} from '../src/data_storage';
import {DatabaseInterface} from '../src';

PouchDB.plugin(PouchDBMemoryAdapter);

const DESIGN_A = {
  _id: '_design/views',
  views: {byId: {map: 'function (doc) { emit(doc._id); }'}},
};
const DESIGN_B = {
  _id: '_design/permissions',
  validate_doc_update: 'function (newDoc) { return; }',
};
const SECURITY = {
  admins: {names: [] as string[], roles: ['admin']},
  members: {names: [] as string[], roles: [] as string[]},
};

const content = (
  designDocuments = [DESIGN_A, DESIGN_B]
): InitialisationContent => ({
  designDocuments,
  securityDocument: SECURITY,
});

describe('decideSetupAction', () => {
  const target = {version: 2, hash: 'abc'};

  it('upgrades when missing or behind', () => {
    expect(decideSetupAction({target})).toBe('upgrade');
    expect(
      decideSetupAction({recorded: {version: 1, hash: 'abc'}, target})
    ).toBe('upgrade');
  });

  it('is up to date when version and hash match', () => {
    expect(
      decideSetupAction({recorded: {version: 2, hash: 'abc'}, target})
    ).toBe('up_to_date');
  });

  it('patches when the version matches but the hash does not', () => {
    expect(
      decideSetupAction({recorded: {version: 2, hash: 'old'}, target})
    ).toBe('patch');
  });

  it('is ahead when the recorded version is higher', () => {
    expect(
      decideSetupAction({recorded: {version: 3, hash: 'whatever'}, target})
    ).toBe('ahead');
  });
});

describe('setup hashing', () => {
  it('is stable and independent of design-doc order and _rev', async () => {
    const forward = await hashDesignDocuments([DESIGN_A, DESIGN_B]);
    const reverse = await hashDesignDocuments([
      {...DESIGN_B, _rev: '1-zzz'},
      {...DESIGN_A, _rev: '2-aaa'},
    ]);
    expect(forward).toMatch(/^[0-9a-f]{64}$/);
    expect(reverse).toBe(forward);
  });

  it('changes when design content changes', async () => {
    const original = await hashDesignDocuments([DESIGN_A]);
    const tweaked = await hashDesignDocuments([
      {...DESIGN_A, views: {byId: {map: 'function (doc) { emit(1); }'}}},
    ]);
    expect(tweaked).not.toBe(original);
  });

  it('hashes security documents deterministically', async () => {
    const first = await hashSecurityDocument(SECURITY);
    const shuffledKeys = {
      members: SECURITY.members,
      admins: SECURITY.admins,
    };
    expect(await hashSecurityDocument(shuffledKeys)).toBe(first);
    expect(
      await hashSecurityDocument({
        ...SECURITY,
        members: {names: ['x'], roles: []},
      })
    ).not.toBe(first);
  });
});

describe('applyVersionedInitialisation', () => {
  let target: DatabaseInterface;
  let setupDb: DatabaseInterface;
  let counter = 0;
  const events: DbSetupEvent[] = [];

  const setupStore = (): DbSetupStore => setupDb as unknown as DbSetupStore;

  beforeEach(() => {
    counter += 1;
    events.length = 0;
    target = new PouchDB(`db-setup-target-${counter}`, {
      adapter: 'memory',
    }) as DatabaseInterface;
    setupDb = new PouchDB(`db-setup-store-${counter}`, {
      adapter: 'memory',
    }) as DatabaseInterface;
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await Promise.all([target.destroy(), setupDb.destroy()]);
  });

  const apply = (
    payload = content(),
    extra: {forceDefaultDoc?: boolean; forceSetup?: boolean} = {}
  ) =>
    applyVersionedInitialisation({
      db: target,
      content: payload,
      setupType: 'PEOPLE',
      dbName: 'people',
      setupStore: setupStore(),
      applyPermissions: false,
      onEvent: event => events.push(event),
      now: () => 1000,
      ...extra,
    });

  it('pushes and records when no setup doc exists', async () => {
    const result = await apply();
    expect(result.design).toBe('upgrade');
    expect(result.security).toBeUndefined();
    const views = await target.get<typeof DESIGN_A>(DESIGN_A._id);
    expect(views.views).toEqual(DESIGN_A.views);
    const record = await readDbSetupDoc(setupStore(), 'PEOPLE', 'people');
    expect(record).toMatchObject({
      kind: DB_SETUP_DOC_KIND,
      dbType: 'PEOPLE',
      dbName: 'people',
      design: {
        version: DB_SETUP_VERSIONS.PEOPLE.design,
        hash: await hashDesignDocuments(content().designDocuments),
        updatedAtMs: 1000,
      },
    });
    expect(record?.security).toBeUndefined();
    expect(isDbSetupDoc(record)).toBe(true);
    expect(events.map(event => `${event.part}:${event.action}`)).toEqual([
      'design:upgrade',
    ]);
  });

  it('skips target-database reads and writes when version and hash match', async () => {
    await apply();
    const get = jest.spyOn(target, 'get');
    const put = jest.spyOn(target, 'put');
    events.length = 0;
    const result = await apply();
    expect(result.design).toBe('up_to_date');
    expect(get).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    expect(events.map(event => event.action)).toEqual(['up_to_date']);
  });

  it('pushes again when the version matches but the hash does not', async () => {
    await apply();
    const id = dbSetupDocId('PEOPLE', 'people');
    const existing = await setupDb.get<DbSetupDoc>(id);
    await setupDb.put({
      ...existing,
      design: {...existing.design!, hash: '0'.repeat(64)},
    });
    const result = await apply(
      content([
        {
          ...DESIGN_A,
          views: {byId: {map: 'function (doc) { emit("patched"); }'}},
        },
        DESIGN_B,
      ])
    );
    expect(result.design).toBe('patch');
    const views = await target.get<any>(DESIGN_A._id);
    expect(views.views.byId.map).toContain('patched');
  });

  it('forceSetup repairs a drifted design doc and rewrites the record when up to date', async () => {
    await apply();
    const drifted = await target.get<any>(DESIGN_A._id);
    await target.put({...drifted, views: {byId: {map: 'function (doc) {}'}}});
    events.length = 0;
    const result = await apply(content(), {forceSetup: true});
    expect(result.design).toBe('forced');
    const views = await target.get<typeof DESIGN_A>(DESIGN_A._id);
    expect(views.views).toEqual(DESIGN_A.views);
    const record = await readDbSetupDoc(setupStore(), 'PEOPLE', 'people');
    expect(record?.design).toEqual({
      version: DB_SETUP_VERSIONS.PEOPLE.design,
      hash: await hashDesignDocuments(content().designDocuments),
      updatedAtMs: 1000,
    });
    expect(events.map(event => event.action)).toEqual(['forced']);
  });

  it('forceSetup still leaves a higher recorded version alone', async () => {
    await apply();
    const id = dbSetupDocId('PEOPLE', 'people');
    const existing = await setupDb.get<DbSetupDoc>(id);
    await setupDb.put({
      ...existing,
      design: {...existing.design!, version: 99},
    });
    const result = await apply(content(), {forceSetup: true});
    expect(result.design).toBe('ahead');
    const record = await readDbSetupDoc(setupStore(), 'PEOPLE', 'people');
    expect(record?.design?.version).toBe(99);
  });

  it('leaves docs and the record untouched when the recorded version is higher', async () => {
    await apply();
    const id = dbSetupDocId('PEOPLE', 'people');
    const existing = await setupDb.get<DbSetupDoc>(id);
    await setupDb.put({
      ...existing,
      design: {...existing.design!, version: 99},
    });
    const revBefore = (await target.get(DESIGN_A._id))._rev;
    const result = await apply();
    expect(result.design).toBe('ahead');
    expect((await target.get(DESIGN_A._id))._rev).toBe(revBefore);
    const record = await readDbSetupDoc(setupStore(), 'PEOPLE', 'people');
    expect(record?.design?.version).toBe(99);
  });

  it('retries a 409 and does not lower a newer record written by another replica', async () => {
    let puts = 0;
    const wrapped: DbSetupStore = {
      get: id => setupDb.get(id),
      put: async doc => {
        puts += 1;
        if (puts === 1) {
          const error = new Error('conflict') as Error & {status: number};
          error.status = 409;
          await setupDb.put({
            _id: dbSetupDocId('PEOPLE', 'people'),
            kind: DB_SETUP_DOC_KIND,
            dbType: 'PEOPLE',
            dbName: 'people',
            design: {version: 99, hash: 'ahead', updatedAtMs: 1},
          });
          throw error;
        }
        return setupDb.put(doc);
      },
    };
    const result = await applyVersionedInitialisation({
      db: target,
      content: content(),
      setupType: 'PEOPLE',
      dbName: 'people',
      setupStore: wrapped,
      applyPermissions: false,
      now: () => 1000,
    });
    expect(result.design).toBe('ahead');
    const record = await readDbSetupDoc(wrapped, 'PEOPLE', 'people');
    expect(record?.design?.version).toBe(99);
  });

  it('unregisters a setup document', async () => {
    await apply();
    const removed = await unregisterDbSetupDoc({
      setupType: 'PEOPLE',
      dbName: 'people',
      setupStore: setupStore(),
    });
    expect(removed.removed).toBe(true);
    expect(await readDbSetupDoc(setupStore(), 'PEOPLE', 'people')).toBeNull();
    expect(
      (
        await unregisterDbSetupDoc({
          setupType: 'PEOPLE',
          dbName: 'people',
          setupStore: setupStore(),
        })
      ).removed
    ).toBe(false);
  });
});

describe('contentForSetupType', () => {
  it('returns init payloads for every setup type', () => {
    for (const type of DB_SETUP_TYPES) {
      const payload = contentForSetupType(type);
      expect(Array.isArray(payload.designDocuments)).toBe(true);
      expect(payload.securityDocument.admins).toBeDefined();
    }
  });
});
