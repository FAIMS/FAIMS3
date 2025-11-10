import * as fs from 'fs';
import * as path from 'path';
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import {
  DatabaseInterface,
  DataDocument,
  DataEngine,
  ExistingFormRecord,
  generateAvpID,
  generateRecordID,
  generateRevisionID,
  NewAvpDBDocument,
  NewFormRecord,
  NewRecordDBDocument,
  NewRevisionDBDocument,
  UISpecification,
} from '../src';

// Setup PouchDB plugins
PouchDB.plugin(PouchDBFind);
PouchDB.plugin(require('pouchdb-adapter-memory'));

describe('DataEngine', () => {
  let db: DatabaseInterface<DataDocument>;
  let engine: DataEngine;
  let uiSpec: UISpecification;
  const databaseName = 'test-db';

  // Load UI specification from JSON file
  const uiSpecPath = path.join(__dirname, 'engineTestUiSpec.json');
  const uiSpecData = fs.readFileSync(uiSpecPath, 'utf-8');
  uiSpec = JSON.parse(uiSpecData)['ui-specification'];

  beforeEach(() => {
    // Create fresh in-memory database
    db = new PouchDB(databaseName, {
      adapter: 'memory',
    }) as DatabaseInterface<DataDocument>;

    // Initialize engine
    engine = new DataEngine({
      dataDb: db,
      uiSpec: uiSpec,
    });
  });

  afterEach(async () => {
    // Clean up database
    await db.destroy();
  });

  describe('Core Operations', () => {
    describe('Record CRUD', () => {
      test('should create a new record', async () => {
        const recordId = generateRecordID();
        const revisionId = generateRevisionID();

        const newRecord: NewRecordDBDocument = {
          _id: recordId,
          record_format_version: 1,
          created: new Date().toISOString(),
          created_by: 'test-user',
          revisions: [revisionId],
          heads: [revisionId],
          type: 'A',
        };

        const created = await engine.core.createRecord(newRecord);

        expect(created._id).toBe(recordId);
        expect(created._rev).toBeDefined();
        expect(created.heads).toContain(revisionId);
      });

      test('should retrieve an existing record', async () => {
        const recordId = generateRecordID();
        const revisionId = generateRevisionID();

        const newRecord: NewRecordDBDocument = {
          _id: recordId,
          record_format_version: 1,
          created: new Date().toISOString(),
          created_by: 'test-user',
          revisions: [revisionId],
          heads: [revisionId],
          type: 'A',
        };

        await engine.core.createRecord(newRecord);
        const retrieved = await engine.core.getRecord(recordId);

        expect(retrieved._id).toBe(recordId);
        expect(retrieved.type).toBe('A');
      });

      test('should update an existing record', async () => {
        const recordId = generateRecordID();
        const revisionId = generateRevisionID();

        const newRecord: NewRecordDBDocument = {
          _id: recordId,
          record_format_version: 1,
          created: new Date().toISOString(),
          created_by: 'test-user',
          revisions: [revisionId],
          heads: [revisionId],
          type: 'A',
        };

        const created = await engine.core.createRecord(newRecord);

        // Update by adding a new revision
        const newRevisionId = generateRevisionID();
        const updated = await engine.core.updateRecord({
          ...created,
          revisions: [...created.revisions, newRevisionId],
          heads: [newRevisionId],
        });

        expect(updated.revisions).toHaveLength(2);
        expect(updated.heads).toContain(newRevisionId);
      });

      test('should delete a record', async () => {
        const recordId = generateRecordID();
        const revisionId = generateRevisionID();

        const newRecord: NewRecordDBDocument = {
          _id: recordId,
          record_format_version: 1,
          created: new Date().toISOString(),
          created_by: 'test-user',
          revisions: [revisionId],
          heads: [revisionId],
          type: 'A',
        };

        const created = await engine.core.createRecord(newRecord);
        await engine.core.deleteRecord(created);

        await expect(engine.core.getRecord(recordId)).rejects.toThrow();
      });
    });

    describe('Revision CRUD', () => {
      test('should create a new revision', async () => {
        const revisionId = generateRevisionID();
        const recordId = generateRecordID();

        const newRevision: NewRevisionDBDocument = {
          _id: revisionId,
          revision_format_version: 1,
          avps: {},
          record_id: recordId,
          parents: [],
          created: new Date().toISOString(),
          created_by: 'test-user',
          type: 'A',
          relationship: {},
        };

        const created = await engine.core.createRevision(newRevision);

        expect(created._id).toBe(revisionId);
        expect(created._rev).toBeDefined();
        expect(created.record_id).toBe(recordId);
      });

      test('should retrieve an existing revision', async () => {
        const revisionId = generateRevisionID();
        const recordId = generateRecordID();

        const newRevision: NewRevisionDBDocument = {
          _id: revisionId,
          revision_format_version: 1,
          avps: {},
          record_id: recordId,
          parents: [],
          created: new Date().toISOString(),
          created_by: 'test-user',
          type: 'A',
          relationship: {},
        };

        await engine.core.createRevision(newRevision);
        const retrieved = await engine.core.getRevision(revisionId);

        expect(retrieved._id).toBe(revisionId);
        expect(retrieved.type).toBe('A');
      });
    });

    describe('AVP CRUD', () => {
      test('should create a new AVP', async () => {
        const avpId = generateAvpID();
        const revisionId = generateRevisionID();
        const recordId = generateRecordID();

        const newAvp: NewAvpDBDocument = {
          _id: avpId,
          avp_format_version: 1,
          type: 'faims-core::String',
          data: 'test value',
          revision_id: revisionId,
          record_id: recordId,
          created: new Date().toISOString(),
          created_by: 'test-user',
        };

        const created = await engine.core.createAvp(newAvp);

        expect(created._id).toBe(avpId);
        expect(created._rev).toBeDefined();
        expect(created.data).toBe('test value');
      });

      test('should retrieve an existing AVP', async () => {
        const avpId = generateAvpID();
        const revisionId = generateRevisionID();
        const recordId = generateRecordID();

        const newAvp: NewAvpDBDocument = {
          _id: avpId,
          avp_format_version: 1,
          type: 'faims-core::String',
          data: 'test value',
          revision_id: revisionId,
          record_id: recordId,
          created: new Date().toISOString(),
          created_by: 'test-user',
        };

        await engine.core.createAvp(newAvp);
        const retrieved = await engine.core.getAvp(avpId);

        expect(retrieved._id).toBe(avpId);
        expect(retrieved.data).toBe('test value');
      });
    });
  });

  describe('Hydrated Operations', () => {
    test('should retrieve a hydrated record with all data', async () => {
      // Create a complete record with revision and AVPs
      const recordId = generateRecordID();
      const revisionId = generateRevisionID();
      const avp1Id = generateAvpID();
      const avp2Id = generateAvpID();

      // Create record
      const record: NewRecordDBDocument = {
        _id: recordId,
        record_format_version: 1,
        created: new Date().toISOString(),
        created_by: 'test-user',
        revisions: [revisionId],
        heads: [revisionId],
        type: 'A',
      };
      await engine.core.createRecord(record);

      // Create AVPs
      const avp1: NewAvpDBDocument = {
        _id: avp1Id,
        avp_format_version: 1,
        type: 'faims-core::String',
        data: 'First value',
        revision_id: revisionId,
        record_id: recordId,
        created: new Date().toISOString(),
        created_by: 'test-user',
      };
      await engine.core.createAvp(avp1);

      const avp2: NewAvpDBDocument = {
        _id: avp2Id,
        avp_format_version: 1,
        type: 'faims-core::String',
        data: 'Second value',
        revision_id: revisionId,
        record_id: recordId,
        created: new Date().toISOString(),
        created_by: 'test-user',
      };
      await engine.core.createAvp(avp2);

      // Create revision
      const revision: NewRevisionDBDocument = {
        _id: revisionId,
        revision_format_version: 1,
        avps: {
          'First-1': avp1Id,
          'Second-1': avp2Id,
        },
        record_id: recordId,
        parents: [],
        created: new Date().toISOString(),
        created_by: 'test-user',
        type: 'A',
        relationship: {},
      };
      await engine.core.createRevision(revision);

      // Hydrate the record
      const hydrated = await engine.hydrated.getHydratedRecord({
        recordId,
      });

      expect(hydrated.record._id).toBe(recordId);
      expect(hydrated.revision._id).toBe(revisionId);
      expect(hydrated.data['First-1'].data).toBe('First value');
      expect(hydrated.data['Second-1'].data).toBe('Second value');
      expect(hydrated.metadata.hadConflict).toBe(false);
    });

    test('should detect conflicts when multiple heads exist', async () => {
      const recordId = generateRecordID();
      const revision1Id = generateRevisionID();
      const revision2Id = generateRevisionID();

      // Create record with multiple heads
      const record: NewRecordDBDocument = {
        _id: recordId,
        record_format_version: 1,
        created: new Date().toISOString(),
        created_by: 'test-user',
        revisions: [revision1Id, revision2Id],
        heads: [revision1Id, revision2Id], // Multiple heads = conflict
        type: 'A',
      };
      await engine.core.createRecord(record);

      // Create revisions
      const revision1: NewRevisionDBDocument = {
        _id: revision1Id,
        revision_format_version: 1,
        avps: {},
        record_id: recordId,
        parents: [],
        created: new Date().toISOString(),
        created_by: 'test-user',
        type: 'A',
        relationship: {},
      };
      await engine.core.createRevision(revision1);

      const revision2: NewRevisionDBDocument = {
        _id: revision2Id,
        revision_format_version: 1,
        avps: {},
        record_id: recordId,
        parents: [],
        created: new Date().toISOString(),
        created_by: 'test-user',
        type: 'A',
        relationship: {},
      };
      await engine.core.createRevision(revision2);

      const hasConflict = await engine.hydrated.hasConflict(recordId);
      expect(hasConflict).toBe(true);

      const heads = await engine.hydrated.getHeads(recordId);
      expect(heads).toHaveLength(2);
    });
  });

  describe('Form Operations', () => {
    test('should create a new record from form data', async () => {
      const formRecord: NewFormRecord = {
        formId: 'A',
        createdBy: 'test-user',
        data: {
          'First-1': 'First field value',
          'Second-1': 'Second field value',
        },
        annotations: {
          'First-1': {
            annotation: 'Test annotation',
            uncertainty: false,
          },
        },
      };

      const revisionId = await engine.form.createRecord(formRecord);
      expect(revisionId).toBeDefined();
    });

    test('should update an existing record from form data', async () => {
      // First create a record
      const formRecord: NewFormRecord = {
        formId: 'A',
        createdBy: 'test-user',
        data: {
          'First-1': 'Initial value',
          'Second-1': 'Initial value 2',
        },
        annotations: {},
      };

      const initialRevisionId = await engine.form.createRecord(formRecord);

      // Extract the record ID from the revision
      const revision = await engine.core.getRevision(initialRevisionId);
      const recordId = revision.record_id;

      // Update the record
      const updateFormRecord: ExistingFormRecord = {
        recordId,
        revisionId: initialRevisionId,
        formId: 'A',
        createdBy: 'test-user',
        data: {
          'First-1': 'Updated value',
          'Second-1': 'Initial value 2', // Unchanged
        },
        annotations: {},
      };

      const newRevisionId = await engine.form.updateRecord(updateFormRecord, {
        updatedBy: 'test-user',
      });

      expect(newRevisionId).toBeDefined();
      expect(newRevisionId).not.toBe(initialRevisionId);

      // Verify the update
      const updatedRecord = await engine.hydrated.getHydratedRecord({
        recordId,
      });

      expect(updatedRecord.data['First-1'].data).toBe('Updated value');
      expect(updatedRecord.data['Second-1'].data).toBe('Initial value 2');
    });

    test('should retrieve an existing form record for editing', async () => {
      // Create a record
      const formRecord: NewFormRecord = {
        formId: 'B',
        createdBy: 'test-user',
        data: {
          'First-2': 'Test value 1',
          'Second-2': 'Test value 2',
        },
        annotations: {
          'First-2': {
            annotation: 'Important note',
            uncertainty: true,
          },
        },
      };

      const revisionId = await engine.form.createRecord(formRecord);
      const revision = await engine.core.getRevision(revisionId);
      const recordId = revision.record_id;

      // Retrieve as existing form record
      const existingFormRecord = await engine.form.getExistingFormRecord({
        recordId,
      });

      expect(existingFormRecord.recordId).toBe(recordId);
      expect(existingFormRecord.revisionId).toBe(revisionId);
      expect(existingFormRecord.data['First-2']).toBe('Test value 1');
      expect(existingFormRecord.data['Second-2']).toBe('Test value 2');
      expect(existingFormRecord.annotations['First-2']?.annotation).toBe(
        'Important note'
      );
      expect(existingFormRecord.annotations['First-2']?.uncertainty).toBe(true);
    });

    test('should reuse AVPs for unchanged fields during update', async () => {
      // Create initial record
      const formRecord: NewFormRecord = {
        formId: 'A',
        createdBy: 'test-user',
        data: {
          'First-1': 'Unchanged value',
          'Second-1': 'Will change',
        },
        annotations: {},
      };

      const initialRevisionId = await engine.form.createRecord(formRecord);
      const initialRevision = await engine.core.getRevision(initialRevisionId);
      const recordId = initialRevision.record_id;

      // Get the initial AVP ID for First-1
      const initialFirstAvpId = initialRevision.avps['First-1'];

      // Update with one field changed
      const updateFormRecord: ExistingFormRecord = {
        recordId,
        revisionId: initialRevisionId,
        formId: 'A',
        createdBy: 'test-user',
        data: {
          'First-1': 'Unchanged value', // Same value
          'Second-1': 'Changed value', // Different value
        },
        annotations: {},
      };

      const newRevisionId = await engine.form.updateRecord(updateFormRecord, {
        updatedBy: 'test-user',
      });

      const newRevision = await engine.core.getRevision(newRevisionId);

      // The AVP ID for First-1 should be reused (unchanged data)
      expect(newRevision.avps['First-1']).toBe(initialFirstAvpId);

      // The AVP ID for Second-1 should be different (changed data)
      expect(newRevision.avps['Second-1']).not.toBe(
        initialRevision.avps['Second-1']
      );
    });
  });
});
