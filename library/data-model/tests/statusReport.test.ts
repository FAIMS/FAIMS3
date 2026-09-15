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
  DocumentNotFoundError,
  formDataToValues,
  FormUpdateData,
  getSummaryValues,
  NotebookDefinition,
  RecordDeletedError,
  RecordStatusReport,
  UnknownFormTypeError,
} from '../src';

// Setup PouchDB plugins
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

describe('Record status report', () => {
  let db: DatabaseInterface<DataDocument>;
  /** Raw Pouch handle for tests that corrupt documents directly. */
  let rawDb: PouchDB.Database;
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
    rawDb = new PouchDB(databaseName, {adapter: 'memory'});
    db = rawDb as unknown as DatabaseInterface<DataDocument>;
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

  const report = (recordId: string) =>
    computeRecordStatusReport({
      engine,
      recordId,
      projectId: PROJECT,
      // Default completion rule for every field type
      isCompleteResolver: () => undefined,
    });

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
      expect(result.progress).toBe(1.0);
      expect(result.formId).toBe('Photo');
    });

    test('empty child fields with no requirement add no units', async () => {
      const {recordId} = await create('Sample', {
        'sample-type': {data: 'soil'},
      });
      const result = await report(recordId);
      // sub-samples is optional and empty
      expect(childField(result, 'sub-samples')).toMatchObject({
        children: [],
      });
      expect(result.progress).toBe(1.0);
    });

    test('a root with an unknown form type is a hard error', async () => {
      // e.g. the record's form was removed from the notebook after creation
      const {recordId} = await create('Ghost');
      await expect(report(recordId)).rejects.toThrow(UnknownFormTypeError);
    });

    test('a record typed with a prototype key is unknown, not a viewset', async () => {
      // 'constructor' is on Object.prototype, so an `in` check would pass it
      const {recordId} = await create('constructor');
      await expect(report(recordId)).rejects.toThrow(UnknownFormTypeError);
    });
  });

  describe('roll-up formula', () => {
    test('required child field with no records is charged once, in own progress', async () => {
      const {recordId} = await create('Site', {'site-id': {data: 'S1'}});
      const result = await report(recordId);
      // own: site-id complete, features incomplete -> 1/2
      expect(result.ownProgress.progress).toBe(0.5);
      expect(childField(result, 'features')).toMatchObject({
        required: true,
        children: [],
        relatedFormId: 'Feature',
      });
      // no live children, so the roll-up is own progress alone
      expect(result.progress).toBe(0.5);
    });

    test('complete and incomplete children roll up per unit', async () => {
      const complete = await create('Feature', {depth: {data: '50'}});
      const empty = await create('Feature');
      const siteDone = await create('Site', {
        'site-id': {data: 'S1'},
        features: {data: [link(complete.recordId)]},
      });
      const siteHalf = await create('Site', {
        'site-id': {data: 'S2'},
        features: {data: [link(empty.recordId)]},
      });

      expect((await report(siteDone.recordId)).progress).toBe(1.0);
      // (1 own + 0 child) / (1 + 1)
      expect((await report(siteHalf.recordId)).progress).toBe(0.5);
    });

    test('every created child is a unit in the denominator', async () => {
      const features = [
        await create('Feature', {depth: {data: '1'}}),
        await create('Feature', {depth: {data: '2'}}),
        await create('Feature'),
      ];
      const {recordId} = await create('Site', {
        'site-id': {data: 'S1'},
        features: {data: features.map(l => link(l.recordId))},
      });
      const result = await report(recordId);
      expect(childField(result, 'features').children).toHaveLength(3);
      // (1 own + 1 + 1 + 0) / (1 + 3)
      expect(result.progress).toBe(0.75);
    });

    test('units sum across multiple child fields', async () => {
      const feature = await create('Feature', {depth: {data: '50'}});
      const photo = await create('Photo');
      const {recordId} = await create('Site', {
        'site-id': {data: 'S1'},
        features: {data: [link(feature.recordId)]},
        photos: {data: [link(photo.recordId)]},
      });
      const result = await report(recordId);
      expect(result.childFields).toHaveLength(2);
      // (1 own + 1 feature + 1 photo) / (1 + 2)
      expect(result.progress).toBe(1.0);
    });

    test('duplicate links to the same child count once', async () => {
      const feature = await create('Feature', {depth: {data: '50'}});
      const {recordId} = await create('Site', {
        'site-id': {data: 'S1'},
        features: {data: [link(feature.recordId), link(feature.recordId)]},
      });
      const result = await report(recordId);
      expect(childField(result, 'features').children).toHaveLength(1);
      expect(result.progress).toBe(1.0);
    });

    test('singleton (non-array) child link values are handled', async () => {
      const feature = await create('Feature', {depth: {data: '50'}});
      const {recordId} = await create('Site', {
        'site-id': {data: 'S1'},
        features: {data: link(feature.recordId)},
      });
      const result = await report(recordId);
      expect(childField(result, 'features').children).toHaveLength(1);
      expect(result.progress).toBe(1.0);
    });

    test('legacy links without a vocab pair still count', async () => {
      const feature = await create('Feature', {depth: {data: '50'}});
      const {recordId} = await create('Site', {
        'site-id': {data: 'S1'},
        features: {data: [{record_id: feature.recordId}]},
      });
      const result = await report(recordId);
      expect(childField(result, 'features').children).toHaveLength(1);
      expect(result.progress).toBe(1.0);
    });

    test('legacy links with a partial vocab pair still count', async () => {
      const feature = await create('Feature', {depth: {data: '50'}});
      const {recordId} = await create('Site', {
        'site-id': {data: 'S1'},
        features: {
          data: [
            {record_id: feature.recordId, relation_type_vocabPair: ['half']},
          ],
        },
      });
      const result = await report(recordId);
      expect(childField(result, 'features').children).toHaveLength(1);
      expect(result.progress).toBe(1.0);
    });

    test('a malformed link entry does not hide its siblings', async () => {
      const feature = await create('Feature', {depth: {data: '50'}});
      const {recordId} = await create('Site', {
        'site-id': {data: 'S1'},
        features: {
          data: [{not_a_link: true}, {record_id: ''}, link(feature.recordId)],
        },
      });
      const result = await report(recordId);
      expect(childField(result, 'features').children).toHaveLength(1);
      expect(result.progress).toBe(1.0);
    });

    test('a legacy bare-string link entry is ignored', async () => {
      const feature = await create('Feature', {depth: {data: '50'}});
      const {recordId} = await create('Site', {
        'site-id': {data: 'S1'},
        // a legacy bare record-id string in place of a link object
        features: {
          data: ['legacy-bare-id', link(feature.recordId)],
        },
      });
      const result = await report(recordId);
      expect(childField(result, 'features').children).toHaveLength(1);
      expect(result.progress).toBe(1.0);
    });

    test('a required child field in two sections counts once', async () => {
      // finds appears in both Trench sections but is still one field
      const {recordId} = await create('Trench', {finds: {data: []}});
      const result = await report(recordId);
      expect(result.ownProgress).toMatchObject({
        requiredCount: 1,
        completedCount: 0,
        progress: 0,
      });
      // no live children, so the roll-up is own progress alone
      expect(result.progress).toBe(0);
    });

    test('a live child completes a two-section field', async () => {
      const photo = await create('Photo');
      const {recordId} = await create('Trench', {
        finds: {data: [link(photo.recordId)]},
      });
      const result = await report(recordId);
      expect(result.ownProgress).toMatchObject({
        requiredCount: 1,
        progress: 1.0,
      });
      expect(result.progress).toBe(1.0);
    });

    test('a field listed in two visible sections reports one child field', async () => {
      // sub-samples appears in both Sample-Main and Sample-Links
      const sub = await create('Sample', {'sample-type': {data: 's2'}});
      const {recordId} = await create('Sample', {
        'sample-type': {data: 's1'},
        'sub-samples': {data: [link(sub.recordId)]},
      });
      const result = await report(recordId);
      expect(
        result.childFields.filter(f => f.fieldId === 'sub-samples')
      ).toHaveLength(1);
    });

    test('a child shared by two parent records reports under each', async () => {
      // shared is incomplete, so each parent scores (1 own + 0) / 2 and the
      // root rolls up (1 own + 0.5 + 0.5) / 3
      const shared = await create('Sample');
      const left = await create('Sample', {
        'sample-type': {data: 'l'},
        'sub-samples': {data: [link(shared.recordId)]},
      });
      const right = await create('Sample', {
        'sample-type': {data: 'r'},
        'sub-samples': {data: [link(shared.recordId)]},
      });
      const root = await create('Feature', {
        depth: {data: '50'},
        samples: {data: [link(left.recordId), link(right.recordId)]},
      });

      const result = await report(root.recordId);
      const parents = childField(result, 'samples').children;
      expect(parents).toHaveLength(2);
      for (const parent of parents) {
        const sharedNode = childField(parent, 'sub-samples').children[0];
        expect(sharedNode.recordId).toBe(shared.recordId);
        expect(parent.progress).toBe(0.5);
      }
      expect(result.progress).toBe(2 / 3);
    });

    test('a child linked from two fields counts one roll-up unit', async () => {
      // shared child is incomplete (depth missing) so double-counting it
      // would show up in the denominator
      const shared = await create('Feature');
      const {recordId} = await create('Site', {
        'site-id': {data: 'S1'},
        features: {data: [link(shared.recordId)]},
        photos: {data: [link(shared.recordId)]},
      });
      const result = await report(recordId);
      expect(childField(result, 'features').children).toHaveLength(1);
      expect(childField(result, 'photos').children).toHaveLength(1);
      // one distinct incomplete child: (1 own + 0 child) / (1 + 1)
      expect(result.progress).toBe(0.5);
    });
  });

  describe('exclusions', () => {
    test('deleted children are skipped and required expectation returns', async () => {
      const feature = await create('Feature', {depth: {data: '50'}});
      const {recordId} = await create('Site', {
        'site-id': {data: 'S1'},
        features: {data: [link(feature.recordId)]},
      });
      await engine.form.deleteRecord({
        recordId: feature.recordId,
        baseRevisionId: feature.revisionId,
        userId: USER,
      });

      const result = await report(recordId);
      expect(childField(result, 'features')).toMatchObject({
        children: [],
      });
      // a link to a deleted child scores no better than an empty field:
      // own drops to 1/2
      expect(result.ownProgress.incompleteRequired).toContain('features');
      expect(result.progress).toBe(0.5);
    });

    test('linked relations are ignored entirely', async () => {
      const calibration = await create('Calibration');
      const {recordId} = await create('Site', {
        'site-id': {data: 'S1'},
        'calibration-ref': {data: [link(calibration.recordId)]},
      });
      const result = await report(recordId);
      expect(
        result.childFields.find(f => f.fieldId === 'calibration-ref')
      ).toBeUndefined();
      expect(result.progress).toBe(0.5);
    });

    test('dangling child references are skipped', async () => {
      const {recordId} = await create('Site', {
        'site-id': {data: 'S1'},
        features: {data: [link('no-such-record')]},
      });
      const result = await report(recordId);
      expect(childField(result, 'features').children).toHaveLength(0);
      // dangling links leave the required features field incomplete
      expect(result.progress).toBe(0.5);
    });

    test('an empty-array child value scores like an absent one', async () => {
      const {recordId} = await create('Site', {
        'site-id': {data: 'S1'},
        features: {data: []},
      });
      const result = await report(recordId);
      expect(result.ownProgress.progress).toBe(0.5);
      expect(result.progress).toBe(0.5);
    });

    test('a child with an unknown form type is skipped, not scored complete', async () => {
      // e.g. the child's form was removed from the notebook after creation
      const ghost = await create('Ghost');
      const live = await create('Feature', {depth: {data: '50'}});
      const {recordId} = await create('Site', {
        'site-id': {data: 'S1'},
        features: {data: [link(live.recordId), link(ghost.recordId)]},
      });
      const result = await report(recordId);
      expect(childField(result, 'features').children).toHaveLength(1);
      expect(result.progress).toBe(1.0);
    });

    test('a link with an empty project id counts as local', async () => {
      const feature = await create('Feature', {depth: {data: '50'}});
      const {recordId} = await create('Site', {
        'site-id': {data: 'S1'},
        features: {data: [{...link(feature.recordId), project_id: ''}]},
      });
      const result = await report(recordId);
      expect(childField(result, 'features').children).toHaveLength(1);
      expect(result.progress).toBe(1.0);
    });

    test('links tagged with another project are skipped', async () => {
      const local = await create('Feature', {depth: {data: '50'}});
      const {recordId} = await create('Site', {
        'site-id': {data: 'S1'},
        features: {
          data: [
            {...link(local.recordId), project_id: PROJECT},
            {...link('foreign-record'), project_id: 'other-project'},
          ],
        },
      });
      const result = await report(recordId);
      expect(childField(result, 'features').children).toHaveLength(1);
      expect(result.progress).toBe(1.0);
    });

    test('a live child with a missing AVP document is skipped, not fatal', async () => {
      const broken = await create('Feature', {depth: {data: '50'}});
      const live = await create('Feature', {depth: {data: '50'}});
      const {recordId} = await create('Site', {
        'site-id': {data: 'S1'},
        features: {data: [link(broken.recordId), link(live.recordId)]},
      });
      const revision = await rawDb.get<{
        avps: Record<string, string>;
      }>(broken.revisionId);
      const avpDoc = await rawDb.get(Object.values(revision.avps)[0]);
      await rawDb.remove(avpDoc);

      const result = await report(recordId);
      expect(childField(result, 'features').children).toHaveLength(1);
      // (1 own + 1 live feature) / (1 + 1)
      expect(result.progress).toBe(1.0);
    });

    test('a missing AVP on the root record is a hard error', async () => {
      const {recordId, revisionId} = await create('Site', {
        'site-id': {data: 'S1'},
      });
      const revision = await rawDb.get<{
        avps: Record<string, string>;
      }>(revisionId);
      const avpDoc = await rawDb.get(Object.values(revision.avps)[0]);
      await rawDb.remove(avpDoc);

      await expect(report(recordId)).rejects.toThrow(DocumentNotFoundError);
    });

    test('a child whose record document fails validation is skipped, not fatal', async () => {
      const live = await create('Feature', {depth: {data: '50'}});
      const corrupt = await create('Feature', {depth: {data: '50'}});
      const doc = await rawDb.get<{created: string}>(corrupt.recordId);
      doc.created = 'not-a-datetime';
      await rawDb.put(doc);

      const {recordId} = await create('Site', {
        'site-id': {data: 'S1'},
        features: {data: [link(live.recordId), link(corrupt.recordId)]},
      });
      const result = await report(recordId);
      expect(childField(result, 'features').children).toHaveLength(1);
      expect(result.progress).toBe(1.0);
    });

    test('a root record that fails validation is a hard error', async () => {
      const {recordId} = await create('Photo');
      const doc = await rawDb.get<{created: string}>(recordId);
      doc.created = 'not-a-datetime';
      await rawDb.put(doc);

      await expect(report(recordId)).rejects.toThrow();
    });

    test('a child field with unparseable params is skipped', async () => {
      const photo = await create('Photo');
      // legacy-children lacks related_type, so its params fail the schema
      const {recordId} = await create('Legacy', {
        'legacy-children': {data: [link(photo.recordId)]},
      });
      const result = await report(recordId);
      expect(result.childFields).toEqual([]);
      expect(result.progress).toBe(1.0);
    });

    test('a duplicate link tagged with another project does not double-report a live child', async () => {
      const feature = await create('Feature', {depth: {data: '50'}});
      const {recordId} = await create('Site', {
        'site-id': {data: 'S1'},
        features: {
          data: [
            {...link(feature.recordId), project_id: 'other-project'},
            link(feature.recordId),
          ],
        },
      });
      const result = await report(recordId);
      expect(childField(result, 'features').children).toHaveLength(1);
      expect(result.progress).toBe(1.0);
    });

    test('a child with corrupt (empty) heads is skipped, not fatal', async () => {
      const live = await create('Feature', {depth: {data: '50'}});
      const corrupt = await create('Feature', {depth: {data: '50'}});
      const doc = await rawDb.get<{heads: string[]}>(corrupt.recordId);
      doc.heads = [];
      await rawDb.put(doc);

      const {recordId} = await create('Site', {
        'site-id': {data: 'S1'},
        features: {data: [link(live.recordId), link(corrupt.recordId)]},
      });
      const result = await report(recordId);
      expect(childField(result, 'features').children).toHaveLength(1);
      // (1 own + 1 live feature) / (1 + 1)
      expect(result.progress).toBe(1.0);
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

  describe('conflicted heads', () => {
    test('the walk scores the same head the record page resolves', async () => {
      const {recordId, revisionId} = await create('Site', {
        'site-id': {data: 'S1'},
      });
      // Forge a second head whose site-id differs, sharing the other AVPs
      const revision = await rawDb.get<{avps: Record<string, string>}>(
        revisionId
      );
      const avp = await rawDb.get<{data: unknown}>(revision.avps['site-id']);
      const forkAvpId = `${avp._id}-fork`;
      const forkRevisionId = `${revisionId}-fork`;
      const {_rev: avpRev, ...avpFields} = avp;
      void avpRev;
      await rawDb.put({...avpFields, _id: forkAvpId, data: 'S2'});
      const {_rev: revisionRev, ...revisionFields} = revision;
      void revisionRev;
      await rawDb.put({
        ...revisionFields,
        _id: forkRevisionId,
        avps: {...revision.avps, 'site-id': forkAvpId},
      });
      const record = await rawDb.get<{heads: string[]; revisions: string[]}>(
        recordId
      );
      await rawDb.put({
        ...record,
        heads: [...record.heads, forkRevisionId].sort(),
        revisions: [...record.revisions, forkRevisionId].sort(),
      });
      const forked = await rawDb.get<{heads: string[]}>(recordId);
      expect(forked.heads).toHaveLength(2);

      const shown = await engine.form.getExistingFormData({recordId});
      const result = await report(recordId);
      expect(result.hrid).toBe(shown.context.hrid);
      expect(result.summaryValues['site-id']).toBe(
        (shown.data['site-id'] as {data: unknown}).data
      );
    });
  });

  describe('hidden child fields', () => {
    test('children linked from a condition-hidden field still report', async () => {
      const {recordId: sampleId} = await create('Sample');
      // survey-mode is not DETAILED, so survey-samples is condition-hidden
      const {recordId} = await create('Survey', {
        'survey-samples': {data: [link(sampleId)]},
      });
      const result = await report(recordId);
      const field = childField(result, 'survey-samples');
      expect(field).toMatchObject({required: false});
      expect(field.children.map(child => child.recordId)).toEqual([sampleId]);
      // The live child is a roll-up unit: (own 1 + child 0) / 2
      expect(result.progress).toBe(0.5);
    });

    test('a hidden required child field with no children drops out entirely', async () => {
      const {recordId} = await create('Survey');
      const result = await report(recordId);
      expect(result.childFields).toEqual([]);
      expect(result.progress).toBe(1.0);
    });

    test('a hidden child field with only a dead link drops out', async () => {
      const sample = await create('Sample');
      const {recordId} = await create('Survey', {
        'survey-samples': {data: [link(sample.recordId)]},
      });
      await engine.form.deleteRecord({
        recordId: sample.recordId,
        baseRevisionId: sample.revisionId,
        userId: USER,
      });
      const result = await report(recordId);
      expect(result.childFields).toEqual([]);
      expect(result.progress).toBe(1.0);
    });

    test("a stale value under another form's child field is ignored", async () => {
      const sample = await create('Sample');
      // survey-samples belongs to the Survey form, not Photo
      const {recordId} = await create('Photo', {
        'survey-samples': {data: [link(sample.recordId)]},
      });
      const result = await report(recordId);
      expect(result.childFields).toEqual([]);
      expect(result.progress).toBe(1.0);
    });
  });

  describe('recursion safety', () => {
    /** Builds a bottom-up Sample chain of `length` records linked via sub-samples; returns ids bottom-first. */
    const buildSampleChain = async (length: number) => {
      let child: string | undefined;
      const ids: string[] = [];
      for (let i = 0; i < length; i++) {
        const {recordId} = await create('Sample', {
          'sample-type': {data: `s${i}`},
          ...(child ? {'sub-samples': {data: [link(child)]}} : {}),
        });
        ids.push(recordId);
        child = recordId;
      }
      return ids;
    };

    test('walks a four-level tree', async () => {
      const subSample = await create('Sample', {
        'sample-type': {data: 's2'},
      });
      const sample = await create('Sample', {
        'sample-type': {data: 's1'},
        'sub-samples': {data: [link(subSample.recordId)]},
      });
      const feature = await create('Feature', {
        depth: {data: '50'},
        samples: {data: [link(sample.recordId)]},
      });
      const site = await create('Site', {
        'site-id': {data: 'S1'},
        features: {data: [link(feature.recordId)]},
      });

      const result = await report(site.recordId);
      expect(result.progress).toBe(1.0);
      const featureNode = childField(result, 'features').children[0];
      const sampleNode = childField(featureNode, 'samples').children[0];
      const subSampleNode = childField(sampleNode, 'sub-samples').children[0];
      expect(subSampleNode.recordId).toBe(subSample.recordId);
    });

    test('a cycle in corrupt data is cut, not recursed forever', async () => {
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
      // the back edge to a is cut and adds no unit
      expect(childField(bNode, 'sub-samples').children).toHaveLength(0);
      expect(bNode.progress).toBe(1.0);
      expect(result.progress).toBe(1.0);
    });

    test('mutually-linked sibling records terminate', async () => {
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
      const root = await create('Feature', {
        depth: {data: '50'},
        samples: {data: [link(a.recordId), link(b.recordId)]},
      });

      const result = await report(root.recordId);
      expect(childField(result, 'samples').children).toHaveLength(2);
    });

    test('a deep chain is walked to its leaf', async () => {
      const ids = await buildSampleChain(15);

      let node = await report(ids[ids.length - 1]);
      let depth = 0;
      while (node.childFields.length > 0 && node.childFields[0].children[0]) {
        node = node.childFields[0].children[0];
        depth += 1;
      }
      expect(depth).toBe(14);
      expect(node.recordId).toBe(ids[0]);
      expect(node.progress).toBe(1.0);
    });
  });

  describe('report contents', () => {
    test('carries hrid and summary field values', async () => {
      const {recordId} = await create('Site', {'site-id': {data: 'S1'}});
      const result = await report(recordId);
      expect(result.hrid).toBe('S1');
      expect(result.summaryValues).toEqual({
        'site-id': 'S1',
        'site-label': null,
      });
    });

    test('condition-hidden summary fields are omitted, statically hidden ones report', async () => {
      // special-note only shows when site-id is SHOW-NOTE; statically hidden
      // site-label (the templated-field pattern) still reports its saved value
      const stale = await create('Site', {
        'site-id': {data: 'S1'},
        'special-note': {data: 'stale'},
        'site-label': {data: 'Site S1'},
      });
      expect((await report(stale.recordId)).summaryValues).toEqual({
        'site-id': 'S1',
        'site-label': 'Site S1',
      });

      const shown = await create('Site', {
        'site-id': {data: 'SHOW-NOTE'},
        'special-note': {data: 'note'},
      });
      expect((await report(shown.recordId)).summaryValues).toEqual({
        'site-id': 'SHOW-NOTE',
        'site-label': null,
        'special-note': 'note',
      });
    });

    test('view conditions and hidden-plus-condition fields gate the summary', async () => {
      // extra-note sits in a view shown only when mode is FULL; both-note is
      // hidden AND condition-gated on the same value: the condition decides
      const partial = await create('Annotated', {
        mode: {data: 'BASIC'},
        'both-note': {data: 'leftover'},
        'extra-note': {data: 'leftover'},
      });
      expect((await report(partial.recordId)).summaryValues).toEqual({
        mode: 'BASIC',
      });

      const full = await create('Annotated', {
        mode: {data: 'FULL'},
        'both-note': {data: 'Note FULL'},
      });
      expect((await report(full.recordId)).summaryValues).toEqual({
        mode: 'FULL',
        'both-note': 'Note FULL',
        'extra-note': null,
      });
    });

    test('a visible summary field with no value reports null', async () => {
      // JSON would drop an undefined value, hiding the column from clients
      const {recordId} = await create('Site', {
        'site-id': {data: 'SHOW-NOTE'},
      });
      expect((await report(recordId)).summaryValues).toEqual({
        'site-id': 'SHOW-NOTE',
        'site-label': null,
        'special-note': null,
      });
    });

    test('getSummaryValues without visibleFields keeps condition-hidden stored values', () => {
      // The record list shows stored data as-is; only the Status tab gates
      expect(
        getSummaryValues({
          uiSpec,
          formId: 'Site',
          values: {'site-id': 'S1', 'special-note': 'left over'},
        })
      ).toEqual({
        'site-id': 'S1',
        'site-label': null,
        'special-note': 'left over',
      });
    });

    test('forms without summary fields report none', async () => {
      const {recordId} = await create('Photo');
      const result = await report(recordId);
      expect(result.summaryValues).toEqual({});
    });

    test('a stale section id in the viewset does not fail visibility', () => {
      // A section deleted in the designer can stay listed in its viewset
      const {uiSpec: staleSpec} = JSON.parse(uiSpecData) as NotebookDefinition;
      staleSpec.viewsets['Photo'].views.push('Deleted-Section');
      compileUiSpecConditionals(staleSpec);
      const visible = currentlyVisibleMap({
        values: {},
        uiSpec: staleSpec as unknown as CompiledNotebookUiSpec,
        viewsetId: 'Photo',
      });
      expect(Object.keys(visible)).toEqual(['Photo-Main']);
    });
  });

  describe('completion (moved from forms)', () => {
    const completionFor = (data: FormUpdateData, formId = 'Site') => {
      const visibilityMap = currentlyVisibleMap({
        values: formDataToValues(data),
        uiSpec,
        viewsetId: formId,
      });
      return {data, visibilityMap, formId};
    };

    test('counts only required fields', async () => {
      const result = completion({
        uiSpec,
        ...completionFor({'site-id': {data: 'S1'}, caption: {data: 'x'}}),
      });
      expect(result.requiredCount).toBe(2);
      expect(result.completedCount).toBe(1);
      expect(result.incompleteRequired).toEqual(['features']);
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
        ...completionFor({'site-id': {data: 'S1'}}),
      });
      expect(hidden.requiredCount).toBe(2);

      const shown = completion({
        uiSpec,
        ...completionFor({'site-id': {data: 'SHOW-NOTE'}}),
      });
      expect(shown.requiredCount).toBe(3);
      expect(shown.incompleteRequired).toContain('special-note');
    });

    test('sections outside the form do not score', () => {
      // Scoring Photo (no required fields) with Site's wider map must not
      // count Site's required fields
      const site = completionFor({});
      const result = completion({
        uiSpec,
        formId: 'Photo',
        data: {},
        visibilityMap: site.visibilityMap,
      });
      expect(result.requiredCount).toBe(0);
      expect(result.progress).toBe(1.0);
    });

    test('isCompleteResolver overrides the default check', async () => {
      const result = completion({
        uiSpec,
        ...completionFor({'site-id': {data: 'S1'}}),
        isCompleteResolver: ({name}) =>
          name === 'FAIMSTextField' ? () => false : undefined,
      });
      // site-id fails the injected check, features still uses the default
      expect(result.incompleteRequired).toContain('site-id');
    });
  });
});
