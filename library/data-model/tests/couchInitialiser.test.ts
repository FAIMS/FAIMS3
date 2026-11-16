// SPDX-License-Identifier: Apache-2.0
import PouchDB from 'pouchdb';
import PouchDBMemoryAdapter from 'pouchdb-adapter-memory';
import {DatabaseInterface} from '../src';
import {couchInitialiser, InitialisationContent} from '../src/data_storage';

PouchDB.plugin(PouchDBMemoryAdapter);

const VIEWS_DOC = '_design/views';
const PERMISSIONS_DOC = '_design/permissions';
const DEFAULT_DOC = 'default';

const buildContent = ({
  map = 'function (doc) { emit(doc._id); }',
  defaultName = 'original',
}: {map?: string; defaultName?: string} = {}): InitialisationContent => ({
  designDocuments: [
    {_id: VIEWS_DOC, views: {byId: {map}}},
    {
      _id: PERMISSIONS_DOC,
      validate_doc_update: 'function (newDoc) { return; }',
    },
  ],
  securityDocument: {
    admins: {names: [], roles: []},
    members: {names: [], roles: []},
  },
  defaultDocument: {_id: DEFAULT_DOC, name: defaultName},
});

const ALL_DOC_IDS = [VIEWS_DOC, PERMISSIONS_DOC, DEFAULT_DOC];

describe('couchInitialiser', () => {
  let db: DatabaseInterface;
  let dbCounter = 0;

  const initialise = (content: InitialisationContent, forceWrite: boolean) =>
    couchInitialiser({
      db,
      content,
      config: {forceWrite, applyPermissions: false},
    });

  const revs = async (): Promise<Record<string, string>> => {
    const result: Record<string, string> = {};
    for (const id of ALL_DOC_IDS) {
      result[id] = (await db.get(id))._rev;
    }
    return result;
  };

  beforeEach(() => {
    dbCounter += 1;
    db = new PouchDB(`couch-initialiser-test-${dbCounter}`, {
      adapter: 'memory',
    }) as DatabaseInterface;
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await db.destroy();
  });

  it.each([true, false])(
    'creates every document in an empty database (forceWrite=%p)',
    async forceWrite => {
      await initialise(buildContent(), forceWrite);

      const views = await db.get<any>(VIEWS_DOC);
      expect(views.views.byId.map).toBe('function (doc) { emit(doc._id); }');
      const permissions = await db.get<any>(PERMISSIONS_DOC);
      expect(permissions.validate_doc_update).toBe(
        'function (newDoc) { return; }'
      );
      const defaultDoc = await db.get<any>(DEFAULT_DOC);
      expect(defaultDoc.name).toBe('original');
    }
  );

  describe('forceWrite: true', () => {
    it('does not rewrite documents that already match', async () => {
      await initialise(buildContent(), true);
      const before = await revs();
      const put = jest.spyOn(db, 'put');

      await initialise(buildContent(), true);

      expect(put).not.toHaveBeenCalled();
      expect(await revs()).toEqual(before);
    });

    it('rewrites only the design document whose content changed', async () => {
      await initialise(buildContent(), true);
      const before = await revs();
      const changedMap = 'function (doc) { emit(doc.type); }';

      await initialise(buildContent({map: changedMap}), true);

      const after = await revs();
      const views = await db.get<any>(VIEWS_DOC);
      expect(views.views.byId.map).toBe(changedMap);
      expect(after[VIEWS_DOC]).not.toBe(before[VIEWS_DOC]);
      expect(after[VIEWS_DOC].startsWith('2-')).toBe(true);
      // Untouched siblings keep their revision.
      expect(after[PERMISSIONS_DOC]).toBe(before[PERMISSIONS_DOC]);
      expect(after[DEFAULT_DOC]).toBe(before[DEFAULT_DOC]);
    });

    it('rewrites the default document when it changed', async () => {
      await initialise(buildContent(), true);
      const before = await revs();

      await initialise(buildContent({defaultName: 'renamed'}), true);

      const after = await revs();
      const defaultDoc = await db.get<any>(DEFAULT_DOC);
      expect(defaultDoc.name).toBe('renamed');
      expect(after[DEFAULT_DOC]).not.toBe(before[DEFAULT_DOC]);
      expect(after[VIEWS_DOC]).toBe(before[VIEWS_DOC]);
    });

    it('removes stored fields that the new content no longer has', async () => {
      const withReduce = buildContent();
      withReduce.designDocuments[0].views!.byId.reduce = '_count';
      await initialise(withReduce, true);

      await initialise(buildContent(), true);

      const views = await db.get<any>(VIEWS_DOC);
      expect(views.views.byId).toEqual({
        map: 'function (doc) { emit(doc._id); }',
      });
    });

    it('treats an undefined field as absent, as CouchDB stores it', async () => {
      const withUndefined = buildContent();
      withUndefined.designDocuments[0].language = undefined;
      await initialise(withUndefined, true);
      const before = await revs();
      const put = jest.spyOn(db, 'put');

      await initialise(withUndefined, true);

      expect(put).not.toHaveBeenCalled();
      expect(await revs()).toEqual(before);
    });

    it('still writes when the document changes between the read and the write', async () => {
      await initialise(buildContent(), true);
      const changedMap = 'function (doc) { emit(doc.type); }';
      // The initialiser reads a revision that is already out of date, so its
      // first write conflicts and it has to pick up the real revision.
      jest.spyOn(db, 'get').mockImplementationOnce(
        async () =>
          ({
            _id: VIEWS_DOC,
            _rev: '1-00000000000000000000000000000000',
            views: {},
          }) as any
      );

      await initialise(buildContent({map: changedMap}), true);

      const views = await db.get<any>(VIEWS_DOC);
      expect(views.views.byId.map).toBe(changedMap);
      expect(views._rev.startsWith('2-')).toBe(true);
    });

    it('propagates a failed read and writes nothing', async () => {
      await initialise(buildContent(), true);
      const before = await revs();
      const readFailure = Object.assign(new Error('No DB shards'), {
        status: 500,
      });
      jest.spyOn(db, 'get').mockRejectedValue(readFailure);
      const put = jest.spyOn(db, 'put');

      await expect(
        initialise(buildContent({map: 'function () {}'}), true)
      ).rejects.toBe(readFailure);

      expect(put).not.toHaveBeenCalled();
      jest.restoreAllMocks();
      expect(await revs()).toEqual(before);
    });
  });

  describe('forceWrite: false', () => {
    it('leaves existing documents untouched even when the content differs', async () => {
      await initialise(buildContent(), false);
      const before = await revs();

      await initialise(
        buildContent({
          map: 'function (doc) { emit(doc.type); }',
          defaultName: 'renamed',
        }),
        false
      );

      expect(await revs()).toEqual(before);
      const views = await db.get<any>(VIEWS_DOC);
      expect(views.views.byId.map).toBe('function (doc) { emit(doc._id); }');
      const defaultDoc = await db.get<any>(DEFAULT_DOC);
      expect(defaultDoc.name).toBe('original');
    });

    it('creates only the documents that are missing', async () => {
      await initialise(buildContent(), false);
      const before = await revs();
      await db.remove(await db.get(PERMISSIONS_DOC));

      await initialise(buildContent(), false);

      const after = await revs();
      expect(after[VIEWS_DOC]).toBe(before[VIEWS_DOC]);
      expect(after[DEFAULT_DOC]).toBe(before[DEFAULT_DOC]);
      const permissions = await db.get<any>(PERMISSIONS_DOC);
      expect(permissions.validate_doc_update).toBe(
        'function (newDoc) { return; }'
      );
    });
  });
});
