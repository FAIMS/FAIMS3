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
} from '../src';

PouchDB.plugin(PouchDBFind);
PouchDB.plugin(require('pouchdb-adapter-memory'));

const PROJECT_ID = 'search-regex-test';

describe('searchRecordsByRegex', () => {
  let db: DatabaseInterface<DataDocument>;
  let engine: DataEngine;

  const uiSpecPath = path.join(__dirname, 'engineTestUiSpec.json');
  const uiSpecData = fs.readFileSync(uiSpecPath, 'utf-8');
  const {uiSpec} = JSON.parse(uiSpecData) as NotebookDefinition;

  beforeEach(async () => {
    db = new PouchDB('test-search-regex-db', {
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

  test('matches AVP data case-insensitively when caseInsensitive is true', async () => {
    const alpha = await engine.form.createRecord({
      formId: 'A',
      createdBy: 'user-1',
      initial: {
        'First-1': {data: 'Alpha SITE'},
      },
    });

    await engine.form.createRecord({
      formId: 'A',
      createdBy: 'user-1',
      initial: {
        'First-1': {data: 'completely different'},
      },
    });

    // Record with array of object data (similar to our related record field)
    // triggers the $elemMatch part of the regex search and crashes
    // with current code
    await engine.form.createRecord({
      formId: 'A',
      createdBy: 'user-1',
      initial: {
        'First-1': {data: [{nested: 'not matching'}]},
      },
    });

    const result = await engine.query.searchRecordsByRegex({
      projectId: PROJECT_ID,
      regex: 'alpha',
      caseInsensitive: true,
    });

    expect(result.records.map(r => r.recordId)).toContain(alpha.record._id);
    expect(result.count).toBe(1);
    expect(result.avpMatchCount).toBe(1);
  });
});
