import * as fs from 'fs';
import * as path from 'path';
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import {
  compileUiSpecConditionals,
  CompiledNotebookUiSpec,
  completion,
  computeRecordStatusReport,
  currentlyVisibleMap,
  DatabaseInterface,
  DataDocument,
  DataEngine,
  FormUpdateData,
  NotebookDefinition,
  RecordDeletedError,
  RecordStatusReport,
  STATUS_REPORT_MAX_DEPTH,
} from '../src';

// Setup PouchDB plugins
PouchDB.plugin(PouchDBFind);
PouchDB.plugin(require('pouchdb-adapter-memory'));

const CHILD_PAIR: [string, string] = ['is child of', 'has child'];
const USER = 'test-user';

/** Forward child link as stored in a RelatedRecordSelector field value. */
const link = (recordId: string) => ({
  record_id: recordId,
  relation_type_vocabPair: CHILD_PAIR,
});

describe('Record status report', () => {
  let db: DatabaseInterface<DataDocument>;
  let engine: DataEngine;
  const databaseName = 'test-status-report-db';

  // Load UI specification from JSON file and compile its conditionals so the
  // visibility-aware completion behaves as it does in the app/api.
  const uiSpecPath = path.join(__dirname, 'statusReportUiSpec.json');
  const uiSpecData = fs.readFileSync(uiSpecPath, 'utf-8');
  const {uiSpec: rawUiSpec} = JSON.parse(uiSpecData) as NotebookDefinition;
  compileUiSpecConditionals(rawUiSpec);
  const uiSpec = rawUiSpec as unknown as CompiledNotebookUiSpec;

  beforeEach(() => {
    db = new PouchDB(databaseName, {
      adapter: 'memory',
    }) as DatabaseInterface<DataDocument>;
    engine = new DataEngine({dataDb: db, uiSpec});
  });

  afterEach(async () => {
    await db.destroy();
  });

  /** Creates a record with initial data, returning its ids. */
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

  const report = (recordId: string, extras = {}) =>
    computeRecordStatusReport({engine, recordId, ...extras});

  /** The child-field entry for fieldId; fails the test if absent. */
  const childField = (node: RecordStatusReport, fieldId: string) => {
    const field = node.childFields.find(f => f.fieldId === fieldId);
    expect(field).toBeDefined();
    return field!;
  };

  describe('leaf records', () => {
    test('form with no required fields is complete', async () => {
      const {recordId} = await create('Photo');
      const result = await report(recordId);
      expect(result.ownProgress.progress).toBe(1.0);
      expect(result.percentComplete).toBe(1.0);
      expect(result.formId).toBe('Photo');
    });

    test('empty child fields with no requirement add no units', async () => {
      const {recordId} = await create('Sample', {
        'sample-type': {data: 'soil'},
      });
      const result = await report(recordId);
      // sub-samples is optional and empty: 0 created, 0 expected
      expect(childField(result, 'sub-samples')).toMatchObject({
        createdCount: 0,
        expectedCount: 0,
      });
      expect(result.percentComplete).toBe(1.0);
    });

    test('record with unknown form type reports a complete leaf', async () => {
      const {recordId} = await create('Ghost');
      const result = await report(recordId);
      expect(result.percentComplete).toBe(1.0);
      expect(result.childFields).toEqual([]);
    });
  });

  describe('roll-up formula', () => {
    test('required child field with no records counts as one expected child', async () => {
      const {recordId} = await create('Cell', {'cell-id': {data: 'C1'}});
      const result = await report(recordId);
      // own: cell-id complete, layers incomplete -> 1/2
      expect(result.ownProgress.progress).toBe(0.5);
      expect(childField(result, 'layers')).toMatchObject({
        required: true,
        createdCount: 0,
        expectedCount: 1,
        relatedFormId: 'Layer',
      });
      // (0.5 own + 0 children) / (1 + 1 expected child)
      expect(result.percentComplete).toBe(0.25);
    });

    test('complete and incomplete children roll up per unit', async () => {
      const complete = await create('Layer', {depth: {data: '225'}});
      const empty = await create('Layer');
      const cellDone = await create('Cell', {
        'cell-id': {data: 'C1'},
        layers: {data: [link(complete.recordId)]},
      });
      const cellHalf = await create('Cell', {
        'cell-id': {data: 'C2'},
        layers: {data: [link(empty.recordId)]},
      });

      expect((await report(cellDone.recordId)).percentComplete).toBe(1.0);
      // (1 own + 0 child) / (1 + 1)
      expect((await report(cellHalf.recordId)).percentComplete).toBe(0.5);
    });

    test('every created child is a unit in the denominator', async () => {
      const layers = [
        await create('Layer', {depth: {data: '1'}}),
        await create('Layer', {depth: {data: '2'}}),
        await create('Layer'),
      ];
      const {recordId} = await create('Cell', {
        'cell-id': {data: 'C1'},
        layers: {data: layers.map(l => link(l.recordId))},
      });
      const result = await report(recordId);
      expect(childField(result, 'layers')).toMatchObject({
        createdCount: 3,
        expectedCount: 3,
      });
      // (1 own + 1 + 1 + 0) / (1 + 3)
      expect(result.percentComplete).toBe(0.75);
    });

    test('units sum across multiple child fields', async () => {
      const layer = await create('Layer', {depth: {data: '225'}});
      const photo = await create('Photo');
      const {recordId} = await create('Cell', {
        'cell-id': {data: 'C1'},
        layers: {data: [link(layer.recordId)]},
        photos: {data: [link(photo.recordId)]},
      });
      const result = await report(recordId);
      expect(result.childFields).toHaveLength(2);
      // (1 own + 1 layer + 1 photo) / (1 + 2)
      expect(result.percentComplete).toBe(1.0);
    });

    test('duplicate links to the same child count once', async () => {
      const layer = await create('Layer', {depth: {data: '225'}});
      const {recordId} = await create('Cell', {
        'cell-id': {data: 'C1'},
        layers: {data: [link(layer.recordId), link(layer.recordId)]},
      });
      const result = await report(recordId);
      expect(childField(result, 'layers')).toMatchObject({
        createdCount: 1,
        expectedCount: 1,
      });
      expect(result.percentComplete).toBe(1.0);
    });

    test('singleton (non-array) child link values are handled', async () => {
      const layer = await create('Layer', {depth: {data: '225'}});
      const {recordId} = await create('Cell', {
        'cell-id': {data: 'C1'},
        layers: {data: link(layer.recordId)},
      });
      const result = await report(recordId);
      expect(childField(result, 'layers').createdCount).toBe(1);
      expect(result.percentComplete).toBe(1.0);
    });
  });

  describe('exclusions', () => {
    test('deleted children are skipped and required expectation returns', async () => {
      const layer = await create('Layer', {depth: {data: '225'}});
      const {recordId} = await create('Cell', {
        'cell-id': {data: 'C1'},
        layers: {data: [link(layer.recordId)]},
      });
      await engine.form.deleteRecord({
        recordId: layer.recordId,
        baseRevisionId: layer.revisionId,
        userId: USER,
      });

      const result = await report(recordId);
      expect(childField(result, 'layers')).toMatchObject({
        createdCount: 0,
        expectedCount: 1,
      });
      expect(result.skippedChildren).toEqual([layer.recordId]);
      // own is 1.0 (the layers field itself holds data), child unit contributes 0
      expect(result.percentComplete).toBe(0.5);
    });

    test('linked relations are ignored entirely', async () => {
      const calibration = await create('Calibration');
      const {recordId} = await create('Cell', {
        'cell-id': {data: 'C1'},
        'calibration-ref': {data: [link(calibration.recordId)]},
      });
      const result = await report(recordId);
      expect(
        result.childFields.find(f => f.fieldId === 'calibration-ref')
      ).toBeUndefined();
      expect(result.percentComplete).toBe(0.25);
    });

    test('dangling child references are skipped', async () => {
      const {recordId} = await create('Cell', {
        'cell-id': {data: 'C1'},
        layers: {data: [link('no-such-record')]},
      });
      const result = await report(recordId);
      expect(result.skippedChildren).toEqual(['no-such-record']);
      expect(result.percentComplete).toBe(0.5);
    });

    test('recordFilter excludes children from counts and payload', async () => {
      const mine = await create('Layer', {depth: {data: '1'}});
      const theirs = await create('Layer', {depth: {data: '2'}}, 'other-user');
      const {recordId} = await create('Cell', {
        'cell-id': {data: 'C1'},
        layers: {data: [link(mine.recordId), link(theirs.recordId)]},
      });
      const result = await report(recordId, {
        recordFilter: (rec: {createdBy: string}) => rec.createdBy === USER,
      });
      expect(childField(result, 'layers').createdCount).toBe(1);
      expect(result.skippedChildren).toEqual([theirs.recordId]);
      // (1 own + 1 remaining layer) / (1 + 1)
      expect(result.percentComplete).toBe(1.0);
    });

    test('deleted root throws RecordDeletedError', async () => {
      const {recordId, revisionId} = await create('Photo');
      await engine.form.deleteRecord({
        recordId,
        baseRevisionId: revisionId,
        userId: USER,
      });
      await expect(report(recordId)).rejects.toThrow(RecordDeletedError);
    });
  });

  describe('recursion safety', () => {
    test('walks a four-level tree', async () => {
      const subSample = await create('Sample', {'sample-type': {data: 's2'}});
      const sample = await create('Sample', {
        'sample-type': {data: 's1'},
        'sub-samples': {data: [link(subSample.recordId)]},
      });
      const layer = await create('Layer', {
        depth: {data: '225'},
        samples: {data: [link(sample.recordId)]},
      });
      const cell = await create('Cell', {
        'cell-id': {data: 'C1'},
        layers: {data: [link(layer.recordId)]},
      });

      const result = await report(cell.recordId);
      expect(result.percentComplete).toBe(1.0);
      const layerNode = childField(result, 'layers').children[0];
      const sampleNode = childField(layerNode, 'samples').children[0];
      const subSampleNode = childField(sampleNode, 'sub-samples').children[0];
      expect(subSampleNode.recordId).toBe(subSample.recordId);
    });

    test('cycles terminate and are reported as skipped', async () => {
      const a = await create('Sample', {'sample-type': {data: 'a'}});
      const b = await create('Sample', {
        'sample-type': {data: 'b'},
        'sub-samples': {data: [link(a.recordId)]},
      });
      await engine.form.updateRevision({
        recordId: a.recordId,
        revisionId: a.revisionId,
        update: {
          'sample-type': {data: 'a'},
          'sub-samples': {data: [link(b.recordId)]},
        },
        mode: 'new',
        updatedBy: USER,
      });

      const result = await report(a.recordId);
      const bNode = childField(result, 'sub-samples').children[0];
      expect(bNode.recordId).toBe(b.recordId);
      expect(bNode.skippedChildren).toEqual([a.recordId]);
      // the cycle edge adds no unit, so both nodes are complete
      expect(bNode.percentComplete).toBe(1.0);
      expect(result.percentComplete).toBe(1.0);
    });

    test('depth cap truncates instead of recursing forever', async () => {
      // Chain two records past the cap, deepest first
      let child: string | undefined;
      const ids: string[] = [];
      for (let i = 0; i < STATUS_REPORT_MAX_DEPTH + 2; i++) {
        const {recordId} = await create('Sample', {
          'sample-type': {data: `s${i}`},
          ...(child ? {'sub-samples': {data: [link(child)]}} : {}),
        });
        ids.push(recordId);
        child = recordId;
      }

      let node = await report(ids[ids.length - 1]);
      let depth = 0;
      while (node.childFields.length > 0 && node.childFields[0].children[0]) {
        node = node.childFields[0].children[0];
        depth += 1;
      }
      expect(node.truncated).toBe(true);
      expect(depth).toBe(STATUS_REPORT_MAX_DEPTH);
    });
  });

  describe('report contents', () => {
    test('carries hrid and summary field values', async () => {
      const {recordId} = await create('Cell', {'cell-id': {data: 'C1'}});
      const result = await report(recordId);
      expect(result.hrid).toBe('C1');
      expect(result.summaryValues).toEqual({'cell-id': 'C1'});
    });

    test('forms without summary fields report none', async () => {
      const {recordId} = await create('Photo');
      const result = await report(recordId);
      expect(result.summaryValues).toEqual({});
    });
  });

  describe('completion (moved from forms)', () => {
    const completionFor = (data: FormUpdateData, formId = 'Cell') => {
      const values: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(data)) values[k] = v.data;
      const visibilityMap = currentlyVisibleMap({
        values,
        uiSpec,
        viewsetId: formId,
      });
      return {data, formId, visibilityMap};
    };

    test('counts only required fields', async () => {
      const result = completion({
        uiSpec,
        ...completionFor({'cell-id': {data: 'C1'}, caption: {data: 'x'}}),
      });
      expect(result.requiredCount).toBe(2);
      expect(result.completedCount).toBe(1);
      expect(result.incompleteRequired).toEqual(['layers']);
    });

    test('empty required set counts as complete', async () => {
      const result = completion({
        uiSpec,
        ...completionFor({}, 'Photo'),
      });
      expect(result.progress).toBe(1.0);
      expect(result.requiredCount).toBe(0);
    });

    test('conditionally hidden required fields are excluded until shown', async () => {
      const hidden = completion({
        uiSpec,
        ...completionFor({'cell-id': {data: 'C1'}}),
      });
      expect(hidden.requiredCount).toBe(2);

      const shown = completion({
        uiSpec,
        ...completionFor({'cell-id': {data: 'SHOW-NOTE'}}),
      });
      expect(shown.requiredCount).toBe(3);
      expect(shown.incompleteRequired).toContain('special-note');
    });

    test('isCompleteResolver overrides the default check', async () => {
      const result = completion({
        uiSpec,
        ...completionFor({'cell-id': {data: 'C1'}}),
        isCompleteResolver: ({name}) =>
          name === 'FAIMSTextField' ? () => false : undefined,
      });
      // cell-id fails the injected check, layers still uses the default
      expect(result.incompleteRequired).toContain('cell-id');
    });
  });
});
