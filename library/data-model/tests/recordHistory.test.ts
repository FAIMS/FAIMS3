import * as fs from 'fs';
import * as path from 'path';
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import {
  compileUiSpecConditionals,
  CompiledNotebookUiSpec,
  computeRecursiveRecordHistory,
  DatabaseInterface,
  DataDocument,
  DataEngine,
  FormUpdateData,
  NotebookDefinition,
  RecordDeletedError,
  RecursiveRecordHistory,
} from '../src';

PouchDB.plugin(PouchDBFind);
PouchDB.plugin(require('pouchdb-adapter-memory'));

const CHILD_PAIR: [string, string] = ['is child of', 'has child'];
const USER = 'test-user';
const PROJECT = 'test-project';

/** Forward child link as stored in a RelatedRecordSelector field value. */
const link = (recordId: string) => ({
  record_id: recordId,
  relation_type_vocabPair: CHILD_PAIR,
});

describe('Recursive record history', () => {
  let db: DatabaseInterface<DataDocument>;
  let engine: DataEngine;
  const databaseName = 'test-record-history-db';

  // The same notebook the status report is tested against, so both walks are
  // exercised over one shape of child links.
  const uiSpecPath = path.join(__dirname, 'statusReportUiSpec.json');
  const {uiSpec: rawUiSpec} = JSON.parse(
    fs.readFileSync(uiSpecPath, 'utf-8')
  ) as NotebookDefinition;
  compileUiSpecConditionals(rawUiSpec);
  const uiSpec = rawUiSpec as unknown as CompiledNotebookUiSpec;

  beforeEach(() => {
    db = new PouchDB(databaseName, {
      adapter: 'memory',
    }) as unknown as DatabaseInterface<DataDocument>;
    engine = new DataEngine({dataDb: db, uiSpec});
  });

  afterEach(async () => {
    await db.destroy();
  });

  const create = async (
    formId: string,
    initial: FormUpdateData = {},
    createdBy = USER
  ) => {
    const {record, revision} = await engine.form.createRecord({
      formId,
      createdBy,
      initial,
    });
    return {recordId: record._id, revisionId: revision._id};
  };

  /** Adds a revision, so a record has a history longer than its creation. */
  const edit = async (
    created: {recordId: string; revisionId: string},
    update: FormUpdateData,
    updatedBy = USER
  ) =>
    engine.form.updateRevision({
      revisionId: created.revisionId,
      recordId: created.recordId,
      update,
      mode: 'merge',
      updatedBy,
    });

  const history = (recordId: string) =>
    computeRecursiveRecordHistory({engine, recordId, projectId: PROJECT});

  /** The child-field entry for fieldId; fails the test if absent. */
  const childField = (node: RecursiveRecordHistory, fieldId: string) => {
    const field = node.childFields.find(f => f.fieldId === fieldId);
    expect(field).toBeDefined();
    return field!;
  };

  test('a leaf record reports its own revisions and no children', async () => {
    const {recordId} = await create('Photo');
    const result = await history(recordId);
    expect(result.recordId).toBe(recordId);
    expect(result.formId).toBe('Photo');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].createdBy).toBe(USER);
    expect(result.childFields).toEqual([]);
  });

  test('a grandchild is reported under its own parent, not flattened', async () => {
    const grandchild = await create('Sample', {'sample-type': {data: 'fines'}});
    const child = await create('Sample', {
      'sample-type': {data: 'core'},
      'sub-samples': {data: [link(grandchild.recordId)]},
    });
    const {recordId: rootId} = await create('Sample', {
      'sample-type': {data: 'soil'},
      'sub-samples': {data: [link(child.recordId)]},
    });

    const result = await history(rootId);
    const childNode = childField(result, 'sub-samples').children[0];
    expect(childNode.recordId).toBe(child.recordId);
    const grandchildNode = childField(childNode, 'sub-samples').children[0];
    expect(grandchildNode.recordId).toBe(grandchild.recordId);
    expect(grandchildNode.childFields).toEqual([]);
  });

  test('two children under one field both report', async () => {
    const first = await create('Sample', {'sample-type': {data: 'core'}});
    const second = await create('Sample', {'sample-type': {data: 'fines'}});
    const {recordId: rootId} = await create('Sample', {
      'sample-type': {data: 'soil'},
      'sub-samples': {data: [link(first.recordId), link(second.recordId)]},
    });

    const result = await history(rootId);
    const ids = childField(result, 'sub-samples').children.map(c => c.recordId);
    expect(ids).toEqual(
      expect.arrayContaining([first.recordId, second.recordId])
    );
  });

  test("a child's history hangs off the field that links it", async () => {
    const child = await create('Sample', {'sample-type': {data: 'core'}});
    const {recordId: parentId} = await create('Sample', {
      'sample-type': {data: 'soil'},
      'sub-samples': {data: [link(child.recordId)]},
    });

    const result = await history(parentId);
    const field = childField(result, 'sub-samples');
    expect(field.children).toHaveLength(1);
    expect(field.children[0].recordId).toBe(child.recordId);
    expect(field.children[0].entries).toHaveLength(1);
  });

  test('work done by someone else on a child is attributed to them', async () => {
    const child = await engine.form.createRecord({
      formId: 'Sample',
      createdBy: 'someone-else',
      initial: {'sample-type': {data: 'core'}},
    });
    const {recordId: parentId} = await create('Sample', {
      'sample-type': {data: 'soil'},
      'sub-samples': {data: [link(child.record._id)]},
    });

    const result = await history(parentId);
    const node = childField(result, 'sub-samples').children[0];
    // The parent's own history names only its own author, which is the gap
    expect(result.entries.map(e => e.createdBy)).toEqual([USER]);
    expect(node.entries.map(e => e.createdBy)).toContain('someone-else');
  });

  test('a field linking nothing live drops out', async () => {
    const {recordId} = await create('Sample', {'sample-type': {data: 'soil'}});
    const result = await history(recordId);
    expect(
      result.childFields.find(f => f.fieldId === 'sub-samples')
    ).toBeUndefined();
  });

  test('a deleted child drops out rather than failing the tree', async () => {
    const child = await create('Sample', {'sample-type': {data: 'core'}});
    const {recordId: parentId} = await create('Sample', {
      'sample-type': {data: 'soil'},
      'sub-samples': {data: [link(child.recordId)]},
    });
    await engine.form.deleteRecord({
      recordId: child.recordId,
      baseRevisionId: child.revisionId,
      userId: USER,
    });

    const result = await history(parentId);
    expect(
      result.childFields.find(f => f.fieldId === 'sub-samples')
    ).toBeUndefined();
    expect(result.entries).toHaveLength(1);
  });

  test('a dangling link is skipped, not thrown', async () => {
    const {recordId: parentId} = await create('Sample', {
      'sample-type': {data: 'soil'},
      'sub-samples': {data: [link('no-such-record')]},
    });
    const result = await history(parentId);
    expect(
      result.childFields.find(f => f.fieldId === 'sub-samples')
    ).toBeUndefined();
  });

  test('a link tagged with another project is not a child', async () => {
    const child = await create('Sample', {'sample-type': {data: 'core'}});
    const {recordId: parentId} = await create('Sample', {
      'sample-type': {data: 'soil'},
      'sub-samples': {
        data: [{...link(child.recordId), project_id: 'another-project'}],
      },
    });
    const result = await history(parentId);
    expect(
      result.childFields.find(f => f.fieldId === 'sub-samples')
    ).toBeUndefined();
  });

  test('a deleted root is an error, as it is for the status report', async () => {
    const photo = await create('Photo');
    await engine.form.deleteRecord({
      recordId: photo.recordId,
      baseRevisionId: photo.revisionId,
      userId: USER,
    });
    await expect(history(photo.recordId)).rejects.toThrow(RecordDeletedError);
  });

  test('a record linked from two fields is walked once, not once per field', async () => {
    // Same record id stored in two different Child fields of the one parent.
    const shared = await create('Photo');
    const {recordId: siteId} = await create('Site', {
      'site-id': {data: 'S1'},
      photos: {data: [link(shared.recordId)]},
      features: {data: [link(shared.recordId)]},
    });

    const visits: string[] = [];
    const real = engine.form.getExistingFormData.bind(engine.form);
    engine.form.getExistingFormData = (args: {recordId: string}) => {
      visits.push(args.recordId);
      return real(args);
    };

    const result = await history(siteId);
    expect(visits.filter(id => id === shared.recordId)).toHaveLength(1);
    // Both fields still report it
    expect(childField(result, 'photos').children[0].recordId).toBe(
      shared.recordId
    );
    expect(childField(result, 'features').children[0].recordId).toBe(
      shared.recordId
    );
  });

  test('a Linked relation is not a child and is not walked', async () => {
    const other = await create('Calibration');
    const {recordId: siteId} = await create('Site', {
      'site-id': {data: 'S1'},
      // calibration-ref is faims-core::Linked, not Child
      'calibration-ref': {data: [link(other.recordId)]},
    });
    const result = await history(siteId);
    expect(
      result.childFields.find(f => f.fieldId === 'calibration-ref')
    ).toBeUndefined();
  });
});
