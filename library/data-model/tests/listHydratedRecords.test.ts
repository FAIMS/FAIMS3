import * as fs from 'fs';
import * as path from 'path';
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import {
  CompiledNotebookUiSpec,
  couchInitialiser,
  DatabaseInterface,
  DataDocument,
  DataEngine,
  initDataDB,
  NotebookDefinition,
  parseUpdatedTimeCursor,
  queryRecordIdsByUpdated,
  UpdatedTimeIndexError,
} from '../src';

PouchDB.plugin(PouchDBFind);
PouchDB.plugin(require('pouchdb-adapter-memory'));

const PROJECT_ID = 'hydrated-list-test';
const BASE_MS = Date.parse('2024-06-01T00:00:00.000Z');

describe('listHydratedRecords', () => {
  let db: DatabaseInterface<DataDocument>;
  let engine: DataEngine;

  const uiSpecPath = path.join(__dirname, 'engineTestUiSpec.json');
  const uiSpecData = fs.readFileSync(uiSpecPath, 'utf-8');
  const {uiSpec} = JSON.parse(uiSpecData) as NotebookDefinition;

  beforeEach(async () => {
    db = new PouchDB('test-hydrated-list-db', {
      adapter: 'memory',
    }) as DatabaseInterface<DataDocument>;
    await couchInitialiser({
      db,
      content: initDataDB({projectId: PROJECT_ID}),
      config: {forceWrite: true, applyPermissions: false},
    });
    engine = new DataEngine({
      dataDb: db,
      uiSpec: uiSpec as unknown as CompiledNotebookUiSpec,
    });
  });

  afterEach(async () => {
    await db.destroy();
  });

  async function createTimedRecord(index: number) {
    const created = await engine.form.createRecord({
      formId: 'A',
      createdBy: 'user-1',
      initial: {
        'First-1': {data: `value-${index}`},
      },
    });
    await engine.core.stampRecordUpdatedAt(
      created.record._id,
      new Date(BASE_MS + index * 1000).toISOString()
    );
    return created;
  }

  test('lists hydrated rows when optional time bounds are omitted', async () => {
    await createTimedRecord(0);
    await createTimedRecord(1);

    const result = await engine.form.listHydratedRecords({
      projectId: PROJECT_ID,
      limit: 10,
    });

    expect(result.records).toHaveLength(2);
    expect(result.nextStartKey).toBeUndefined();
    for (const row of result.records) {
      expect(row.formId).toBe('A');
      expect(row.data['First-1']).toEqual(expect.any(Object));
      expect(row.data['First-1']).toHaveProperty('data');
      expect(typeof row.data['First-1'].data).toBe('string');
      expect(row.context.hrid).toBeDefined();
    }
  });

  test('pages through the time index then hydrates without overlap', async () => {
    const created = [
      await createTimedRecord(0),
      await createTimedRecord(1),
      await createTimedRecord(2),
      await createTimedRecord(3),
    ];

    const page1 = await engine.form.listHydratedRecords({
      projectId: PROJECT_ID,
      updatedAfter: 0,
      limit: 2,
    });
    expect(page1.records).toHaveLength(2);
    expect(page1.records.map(r => r.recordId)).toEqual([
      created[0].record._id,
      created[1].record._id,
    ]);
    expect(page1.records[0].data['First-1'].data).toBe('value-0');
    expect(page1.nextStartKey).toBeDefined();
    expect(parseUpdatedTimeCursor(page1.nextStartKey)).toEqual([
      BASE_MS + 1000,
      created[1].record._id,
    ]);

    const page2 = await engine.form.listHydratedRecords({
      projectId: PROJECT_ID,
      updatedAfter: 0,
      limit: 2,
      startKey: page1.nextStartKey,
    });
    expect(page2.records.map(r => r.recordId)).toEqual([
      created[2].record._id,
      created[3].record._id,
    ]);
    const seen = new Set(page1.records.map(r => r.recordId));
    page2.records.forEach(r => expect(seen.has(r.recordId)).toBe(false));
  });

  test('throws UpdatedTimeIndexError when the time index view is missing', async () => {
    const design = await db.get('_design/index');
    await db.remove(design);

    await expect(
      queryRecordIdsByUpdated({
        dataDb: db,
        updatedAfter: 0,
        limit: 1,
      })
    ).rejects.toBeInstanceOf(UpdatedTimeIndexError);
  });

  test('omits a failed hydrate and still returns the rest of the page', async () => {
    const a = await createTimedRecord(0);
    const b = await createTimedRecord(1);
    const c = await createTimedRecord(2);

    const revision = await engine.core.getRevision(b.revision._id);
    for (const avpId of Object.values(revision.avps)) {
      const avp = await db.get(avpId);
      await db.remove(avp);
    }

    const result = await engine.form.listHydratedRecords({
      projectId: PROJECT_ID,
      updatedAfter: 0,
    });
    expect(result.records.map(r => r.recordId)).toEqual([
      a.record._id,
      c.record._id,
    ]);
    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.errors).toEqual([
      {recordId: b.record._id, revisionId: b.revision._id},
    ]);
    expect(result.records.every(r => r.data['First-1']?.data)).toBe(true);
  });
});
