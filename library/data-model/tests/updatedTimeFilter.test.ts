import {getDataDB, registerClient} from '../src';
import {notebookRecordIterator} from '../src/data_storage';
import {
  encodeUpdatedTimeCursor,
  queryRecordIdsByUpdated,
} from '../src/data_storage/updatedTimeFilter';
import {EncodedRecord} from '../src/types';
import {
  callbackObject,
  cleanDataDBS,
  createNRecords,
  createRecord,
} from './mocks';

registerClient(callbackObject);
console.debug = () => {};

const BASE_MS = Date.parse('2024-06-01T00:00:00.000Z');

async function setRecordUpdatedAt(
  projectId: string,
  recordId: string,
  updatedAt: string
): Promise<void> {
  const dataDb = await getDataDB(projectId);
  const doc = await dataDb.get<EncodedRecord>(recordId);
  await dataDb.put({...doc, updatedAt});
}

async function seedTimedRecords(projectId: string, viewId: string, n: number) {
  const uiSpec = await createNRecords(projectId, viewId, n);
  const dataDb = await getDataDB(projectId);
  const all = await dataDb.query('index/record', {include_docs: false});
  const ids = all.rows.map(row => row.id).sort();
  for (let i = 0; i < ids.length; i++) {
    await setRecordUpdatedAt(
      projectId,
      ids[i],
      new Date(BASE_MS + i * 1000).toISOString()
    );
  }
  return {uiSpec, ids, dataDb};
}

describe('queryRecordIdsByUpdated', () => {
  beforeEach(async () => {
    await cleanDataDBS();
  });

  test('after-only, before-only, both, and empty sides', async () => {
    const projectId = 'updated-range';
    const {ids, dataDb} = await seedTimedRecords(projectId, 'Test', 5);
    // ids[0]=BASE, ids[1]=+1s, ids[2]=+2s, ids[3]=+3s, ids[4]=+4s

    const afterOnly = await queryRecordIdsByUpdated({
      dataDb,
      updatedAfter: BASE_MS + 2000,
    });
    expect(afterOnly.recordIds).toEqual([ids[3], ids[4]]);

    const beforeOnly = await queryRecordIdsByUpdated({
      dataDb,
      updatedBefore: BASE_MS + 2000,
    });
    expect(beforeOnly.recordIds).toEqual([ids[0], ids[1]]);

    const both = await queryRecordIdsByUpdated({
      dataDb,
      updatedAfter: BASE_MS + 1000,
      updatedBefore: BASE_MS + 4000,
    });
    expect(both.recordIds).toEqual([ids[2], ids[3]]);

    const neither = await queryRecordIdsByUpdated({dataDb});
    expect(neither.recordIds).toEqual(ids);

    const emptyAfter = await queryRecordIdsByUpdated({
      dataDb,
      updatedAfter: BASE_MS + 4000,
    });
    expect(emptyAfter.recordIds).toEqual([]);

    const emptyBefore = await queryRecordIdsByUpdated({
      dataDb,
      updatedBefore: BASE_MS,
    });
    expect(emptyBefore.recordIds).toEqual([]);
  });

  test('pagination cursor skips the current row', async () => {
    const projectId = 'updated-page';
    const {ids, dataDb} = await seedTimedRecords(projectId, 'Test', 4);

    const page1 = await queryRecordIdsByUpdated({
      dataDb,
      limit: 2,
    });
    expect(page1.recordIds).toEqual([ids[0], ids[1]]);
    expect(page1.nextStartKey).toBe(
      encodeUpdatedTimeCursor(BASE_MS + 1000, ids[1])
    );

    const page2 = await queryRecordIdsByUpdated({
      dataDb,
      limit: 2,
      startKey: page1.nextStartKey,
    });
    expect(page2.recordIds).toEqual([ids[2], ids[3]]);
    expect(page2.nextStartKey).toBeUndefined();

    const invalidCursor = await queryRecordIdsByUpdated({
      dataDb,
      startKey: ids[0],
    });
    expect(invalidCursor.recordIds).toEqual([]);
    expect(invalidCursor.nextStartKey).toBeUndefined();
  });
});

describe('notebookRecordIterator time filter', () => {
  beforeEach(async () => {
    await cleanDataDBS();
  });

  test('terminates across more than batchSize records with no duplicate ids', async () => {
    const projectId = 'updated-iterator';
    const viewID = 'Test';
    const n = 25;
    const {uiSpec, dataDb} = await seedTimedRecords(projectId, viewID, n);

    const iterator = await notebookRecordIterator({
      dataDb,
      projectId,
      viewID,
      uiSpecification: uiSpec,
      updatedAfter: 0,
    });

    const seen = new Set<string>();
    let {record, done} = await iterator.next();
    let steps = 0;
    while (!done) {
      steps++;
      expect(steps).toBeLessThanOrEqual(n + 2);
      if (record) {
        expect(seen.has(record.record_id)).toBe(false);
        seen.add(record.record_id);
      }
      const next = await iterator.next();
      record = next.record;
      done = next.done;
    }
    expect(seen.size).toBe(n);
  });

  test('createRecord helper still seeds updatedAt for range queries', async () => {
    const projectId = 'updated-seed';
    await createRecord(projectId, 'Test', {name: 'Ann', age: 1});
    const dataDb = await getDataDB(projectId);
    const all = await queryRecordIdsByUpdated({dataDb, updatedAfter: 0});
    expect(all.recordIds).toHaveLength(1);
  });
});
