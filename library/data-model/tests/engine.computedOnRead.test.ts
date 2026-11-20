// SPDX-License-Identifier: Apache-2.0
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import {compileUiSpecConditionals} from '@faims3/data-model';
import {
  CompiledNotebookUiSpec,
  DatabaseInterface,
  DataDocument,
  DataEngine,
} from '../src';

PouchDB.plugin(PouchDBFind);
PouchDB.plugin(require('pouchdb-adapter-memory'));

const field = (typeReturned: string, componentName = 'TextField') => ({
  'component-namespace': 'faims-custom',
  'component-name': componentName,
  'type-returned': typeReturned,
  'component-parameters': {},
});

const makeSpec = (): CompiledNotebookUiSpec => {
  const spec: any = {
    viewsets: {Plot: {views: ['Plot-view'], label: 'Plot'}},
    views: {
      'Plot-view': {fields: ['Width', 'Height', 'Area'], label: 'Plot'},
    },
    fields: {
      Width: field('faims-core::Number'),
      Height: field('faims-core::Number'),
      Area: {
        ...field('faims-core::Number', 'ComputedNumber'),
        'component-parameters': {expression: '{Width} * {Height}'},
      },
    },
    visible_types: ['Plot'],
  };
  compileUiSpecConditionals(spec);
  return spec as CompiledNotebookUiSpec;
};

describe('computed fields on read', () => {
  let db: DatabaseInterface<DataDocument>;
  let engine: DataEngine;

  beforeEach(() => {
    db = new PouchDB('test-computed-on-read-db', {
      adapter: 'memory',
    }) as DatabaseInterface<DataDocument>;
    engine = new DataEngine({dataDb: db, uiSpec: makeSpec()});
  });

  afterEach(async () => {
    await db.destroy();
  });

  // A record whose stored Area (99) no longer matches its inputs (2 x 3).
  const createStalePlot = async () => {
    const created = await engine.form.createRecord({
      formId: 'Plot',
      createdBy: 'user-1',
    });
    await engine.form.updateRevision({
      revisionId: created.revision._id,
      recordId: created.record._id,
      update: {Width: {data: 2}, Height: {data: 3}, Area: {data: 99}},
      mode: 'new',
      updatedBy: 'user-1',
    });
    return created;
  };

  test('a head read returns the value computed from current inputs', async () => {
    const {record} = await createStalePlot();
    const formData = await engine.form.getExistingFormData({
      recordId: record._id,
    });
    expect(formData.data.Area.data).toBe(6);
    expect(formData.data.Width.data).toBe(2);
  });

  test('the stored value is left untouched', async () => {
    const {record} = await createStalePlot();
    await engine.form.getExistingFormData({recordId: record._id});
    const stored = await engine.hydrated.getHydratedRecord({
      recordId: record._id,
    });
    expect(stored.data.Area.data).toBe(99);
  });

  test('a past revision shows what was saved', async () => {
    const {record, revision} = await createStalePlot();
    await engine.form.createRevision({
      recordId: record._id,
      revisionId: revision._id,
      createdBy: 'user-2',
    });
    const past = await engine.form.getExistingFormData({
      recordId: record._id,
      revisionId: revision._id,
    });
    expect(past.data.Area.data).toBe(99);
  });
});
