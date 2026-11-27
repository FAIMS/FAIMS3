// SPDX-License-Identifier: Apache-2.0
/**
 * Integration baseline for computed fields, run against the Computed Sampler
 * notebook through a real in-memory engine. Records are written without a
 * form, so nothing is stored for their computed fields: every value asserted
 * here comes from resolution on read.
 */
import {
  DatabaseInterface,
  DataDbType,
  DataDocument,
  DataEngine,
  notebookRecordIterator,
} from '../src';
import {
  CALIBRATION_PAIR,
  createFeature,
  createSamplerEngine,
  createSamplerRecord,
  deleteSamplerRecord,
  readValue,
  SAMPLE_PAIR,
  SAMPLER_PROJECT,
  setSamplerValues,
  singleLinkTo,
} from './computedSamplerTestSupport';

describe('Computed Sampler', () => {
  let db: DatabaseInterface<DataDocument>;
  let engine: DataEngine;
  let uiSpec: DataEngine['uiSpec'];

  beforeEach(async () => {
    ({db, engine, uiSpec} = await createSamplerEngine(
      'test-computed-sampler-db'
    ));
  });

  afterEach(async () => {
    await db.destroy();
  });

  // Site: area 10, scale 2. Feature: count 30, depth 4.
  const createSiteWithFeature = async () => {
    const siteId = await createSamplerRecord(engine, 'Site', {
      'Site-Name': 'S1',
      'Site-Area': 10,
      'Site-Scale': 2,
    });
    const {recordId: featureId} = await createFeature(engine, siteId, {
      'Feature-Name': 'F1',
      'Feature-Count': 30,
      'Feature-Depth': 4,
    });
    return {siteId, featureId};
  };

  describe('parent references', () => {
    test('a child resolves a value from its parent', async () => {
      const {featureId} = await createSiteWithFeature();
      expect(await readValue(engine, featureId, 'Feature-Density')).toBe(3);
    });

    test("a child resolves a reference to its parent's computed field", async () => {
      const {siteId, featureId} = await createSiteWithFeature();
      expect(await readValue(engine, siteId, 'Site-Scaled-Area')).toBe(20);
      expect(await readValue(engine, featureId, 'Feature-Scaled-Density')).toBe(
        1.5
      );
    });

    test('a parent edit reaches the child with no write to the child', async () => {
      const {siteId, featureId} = await createSiteWithFeature();
      const before = await engine.core.getRecord(featureId);
      await setSamplerValues(engine, siteId, {'Site-Area': 20});

      expect(await readValue(engine, featureId, 'Feature-Density')).toBe(1.5);
      const after = await engine.core.getRecord(featureId);
      expect(after.revisions).toEqual(before.revisions);
      expect(after._rev).toBe(before._rev);
    });
  });

  describe('linked references', () => {
    // Calibration: cutter 50, tare 10. Test: wet mass 100.
    const createTestWithCalibration = async () => {
      const calibrationId = await createSamplerRecord(engine, 'Calibration', {
        'Cutter-ID': 'C1',
        'Cutter-Mass-g': 50,
        'Tare-g': 10,
      });
      const testId = await createSamplerRecord(engine, 'Test', {
        'Test-Name': 'T1',
        'Wet-Mass-g': 100,
        'Core-Calibration': singleLinkTo(calibrationId, CALIBRATION_PAIR),
      });
      return {calibrationId, testId};
    };

    test("a record resolves a reference to its linked record's computed field", async () => {
      const {testId} = await createTestWithCalibration();
      expect(await readValue(engine, testId, 'Soil-Mass-g')).toBe(60);
    });

    test('an edit to the linked record reaches the record that links to it', async () => {
      const {calibrationId, testId} = await createTestWithCalibration();
      await setSamplerValues(engine, calibrationId, {'Tare-g': 20});
      expect(await readValue(engine, testId, 'Soil-Mass-g')).toBe(70);
    });
  });

  describe('self-reference through a link', () => {
    const createSample = (name: string, previousId?: string) =>
      createSamplerRecord(engine, 'Sample', {
        'Sample-Name': name,
        'Sample-Increment': 1,
        ...(previousId
          ? {'Previous-Sample': singleLinkTo(previousId, SAMPLE_PAIR)}
          : {}),
      });

    test('a long chain resolves without walking it all', async () => {
      let previousId: string | undefined;
      for (let i = 0; i < 30; i++) {
        previousId = await createSample(`S${i}`, previousId);
      }
      // No starting value, so the level is blank; the read must still return.
      expect(await readValue(engine, previousId!, 'Sample-Level')).toBeFalsy();
    });

    test('two records that link to each other resolve without looping', async () => {
      const a = await createSample('A');
      const b = await createSample('B', a);
      await setSamplerValues(engine, a, {
        'Previous-Sample': singleLinkTo(b, SAMPLE_PAIR),
      });
      expect(await readValue(engine, a, 'Sample-Level')).toBeFalsy();
      expect(await readValue(engine, b, 'Sample-Level')).toBeFalsy();
    });
  });

  describe('deleted records', () => {
    test('a deleted parent blanks the value, even when one is stored', async () => {
      const {siteId, featureId} = await createSiteWithFeature();
      await setSamplerValues(engine, featureId, {'Feature-Density': 3});
      await deleteSamplerRecord(engine, siteId);
      expect(await readValue(engine, featureId, 'Feature-Density')).toBeNull();
    });

    test('a deleted linked record blanks the value, even when one is stored', async () => {
      const calibrationId = await createSamplerRecord(engine, 'Calibration', {
        'Cutter-ID': 'C1',
        'Cutter-Mass-g': 50,
        'Tare-g': 10,
      });
      const testId = await createSamplerRecord(engine, 'Test', {
        'Test-Name': 'T1',
        'Wet-Mass-g': 100,
        'Core-Calibration': singleLinkTo(calibrationId, CALIBRATION_PAIR),
        'Soil-Mass-g': 60,
      });
      await deleteSamplerRecord(engine, calibrationId);
      expect(await readValue(engine, testId, 'Soil-Mass-g')).toBeNull();
    });
  });

  describe('list and export reads', () => {
    test('the list read resolves each row', async () => {
      const {featureId} = await createSiteWithFeature();
      const {records} = await engine.form.listHydratedRecords({
        projectId: SAMPLER_PROJECT,
        formId: 'Feature',
      });
      const row = records.find(r => r.recordId === featureId);
      expect(row?.data['Feature-Density']?.data).toBe(3);
    });

    test('the export iterator resolves each record when given an engine', async () => {
      const {featureId} = await createSiteWithFeature();
      const iterator = await notebookRecordIterator({
        dataDb: db as unknown as DataDbType,
        projectId: SAMPLER_PROJECT,
        uiSpecification: uiSpec,
        viewID: 'Feature',
        includeAttachments: false,
        engine,
      });
      const {record} = await iterator.next();
      expect(record?.record_id).toBe(featureId);
      expect(record?.data['Feature-Density']).toBe(3);
    });
  });
});
