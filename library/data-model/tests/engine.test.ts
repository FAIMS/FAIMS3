import * as fs from 'fs';
import * as path from 'path';
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import {
  DatabaseInterface,
  DataDocument,
  DataEngine,
  ExistingFormRecord,
  generateAttID,
  generateAvpID,
  generateRecordID,
  generateRevisionID,
  NewAvpDBDocument,
  NewFormRecord,
  NewPendingAttachmentDBDocument,
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

      test('should update an existing AVP', async () => {
        const avpId = generateAvpID();
        const revisionId = generateRevisionID();
        const recordId = generateRecordID();

        const newAvp: NewAvpDBDocument = {
          _id: avpId,
          avp_format_version: 1,
          type: 'faims-core::String',
          data: 'initial value',
          revision_id: revisionId,
          record_id: recordId,
          created: new Date().toISOString(),
          created_by: 'test-user',
        };

        const created = await engine.core.createAvp(newAvp);

        // Update the AVP with new data
        const updated = await engine.core.updateAvp({
          ...created,
          data: 'updated value',
        });

        expect(updated._id).toBe(avpId);
        expect(updated._rev).not.toBe(created._rev);
        expect(updated.data).toBe('updated value');
      });

      test('should delete an AVP', async () => {
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
        await engine.core.deleteAvp(created);

        await expect(engine.core.getAvp(avpId)).rejects.toThrow();
      });

      test('should create AVP with annotations', async () => {
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
          annotations: {
            annotation: 'This is a test annotation',
            uncertainty: true,
          },
        };

        const created = await engine.core.createAvp(newAvp);

        expect(created.annotations).toEqual({
          annotation: 'This is a test annotation',
          uncertainty: true,
        });
      });

      test('should create AVP with complex data types', async () => {
        const avpId = generateAvpID();
        const revisionId = generateRevisionID();
        const recordId = generateRecordID();

        const complexData = {
          name: 'Test',
          count: 42,
          items: ['a', 'b', 'c'],
          nested: {key: 'value'},
        };

        const newAvp: NewAvpDBDocument = {
          _id: avpId,
          avp_format_version: 1,
          type: 'faims-core::JSON',
          data: complexData,
          revision_id: revisionId,
          record_id: recordId,
          created: new Date().toISOString(),
          created_by: 'test-user',
        };

        const created = await engine.core.createAvp(newAvp);

        expect(created.data).toEqual(complexData);
      });
    });

    describe('Attachment CRUD', () => {
      test('should create a new attachment', async () => {
        const attachmentId = generateAttID();
        const avpId = generateAvpID();
        const revisionId = generateRevisionID();
        const recordId = generateRecordID();

        const testData = Buffer.from('test file content').toString('base64');

        const newAttachment: NewPendingAttachmentDBDocument = {
          _id: attachmentId,
          attach_format_version: 1,
          avp_id: avpId,
          revision_id: revisionId,
          record_id: recordId,
          created: new Date().toISOString(),
          created_by: 'test-user',
          filename: 'test.txt',
          _attachments: {
            'test.txt': {
              content_type: 'text/plain',
              data: testData,
            },
          },
        };

        const created = await engine.core.createAttachment(newAttachment);

        expect(created._id).toBe(attachmentId);
        expect(created._rev).toBeDefined();
        expect(created.filename).toBe('test.txt');
        expect(created._attachments['test.txt']).toBeDefined();
      });

      test('should retrieve an existing attachment', async () => {
        const attachmentId = generateAttID();
        const avpId = generateAvpID();
        const revisionId = generateRevisionID();
        const recordId = generateRecordID();

        const testData = Buffer.from('test file content').toString('base64');

        const newAttachment: NewPendingAttachmentDBDocument = {
          _id: attachmentId,
          attach_format_version: 1,
          avp_id: avpId,
          revision_id: revisionId,
          record_id: recordId,
          created: new Date().toISOString(),
          created_by: 'test-user',
          filename: 'test.txt',
          _attachments: {
            'test.txt': {
              content_type: 'text/plain',
              data: testData,
            },
          },
        };

        await engine.core.createAttachment(newAttachment);
        const retrieved = await engine.core.getAttachment(attachmentId);

        expect(retrieved._id).toBe(attachmentId);
        expect(retrieved.filename).toBe('test.txt');
        // Attachment stored
        expect(retrieved._attachments['test.txt'].digest).toBeDefined();
      });

      test('should update an existing attachment', async () => {
        const attachmentId = generateAttID();
        const avpId = generateAvpID();
        const revisionId = generateRevisionID();
        const recordId = generateRecordID();

        const testData = Buffer.from('test file content').toString('base64');

        const newAttachment: NewPendingAttachmentDBDocument = {
          _id: attachmentId,
          attach_format_version: 1,
          avp_id: avpId,
          revision_id: revisionId,
          record_id: recordId,
          created: new Date().toISOString(),
          created_by: 'test-user',
          filename: 'test.txt',
          _attachments: {
            'test.txt': {
              content_type: 'text/plain',
              data: testData,
            },
          },
        };

        const created = await engine.core.createAttachment(newAttachment);

        // Update the filename
        const updated = await engine.core.updateAttachment({
          ...created,
          filename: 'updated.txt',
        });

        expect(updated._id).toBe(attachmentId);
        expect(updated._rev).not.toBe(created._rev);
        expect(updated.filename).toBe('updated.txt');
      });

      test('should delete an attachment', async () => {
        const attachmentId = generateAttID();
        const avpId = generateAvpID();
        const revisionId = generateRevisionID();
        const recordId = generateRecordID();

        const testData = Buffer.from('test file content').toString('base64');

        const newAttachment: NewPendingAttachmentDBDocument = {
          _id: attachmentId,
          attach_format_version: 1,
          avp_id: avpId,
          revision_id: revisionId,
          record_id: recordId,
          created: new Date().toISOString(),
          created_by: 'test-user',
          filename: 'test.txt',
          _attachments: {
            'test.txt': {
              content_type: 'text/plain',
              data: testData,
            },
          },
        };

        const created = await engine.core.createAttachment(newAttachment);
        await engine.core.deleteAttachment(created);

        await expect(engine.core.getAttachment(attachmentId)).rejects.toThrow();
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

    test('should retrieve multiple hydrated records in parallel', async () => {
      // Create two complete records
      const recordId1 = generateRecordID();
      const revisionId1 = generateRevisionID();
      const avpId1 = generateAvpID();

      const recordId2 = generateRecordID();
      const revisionId2 = generateRevisionID();
      const avpId2 = generateAvpID();

      // Create first record
      await engine.core.createRecord({
        _id: recordId1,
        record_format_version: 1,
        created: new Date().toISOString(),
        created_by: 'test-user',
        revisions: [revisionId1],
        heads: [revisionId1],
        type: 'A',
      });

      await engine.core.createAvp({
        _id: avpId1,
        avp_format_version: 1,
        type: 'faims-core::String',
        data: 'Record 1 data',
        revision_id: revisionId1,
        record_id: recordId1,
        created: new Date().toISOString(),
        created_by: 'test-user',
      });

      await engine.core.createRevision({
        _id: revisionId1,
        revision_format_version: 1,
        avps: {'First-1': avpId1},
        record_id: recordId1,
        parents: [],
        created: new Date().toISOString(),
        created_by: 'test-user',
        type: 'A',
        relationship: {},
      });

      // Create second record
      await engine.core.createRecord({
        _id: recordId2,
        record_format_version: 1,
        created: new Date().toISOString(),
        created_by: 'test-user',
        revisions: [revisionId2],
        heads: [revisionId2],
        type: 'B',
      });

      await engine.core.createAvp({
        _id: avpId2,
        avp_format_version: 1,
        type: 'faims-core::String',
        data: 'Record 2 data',
        revision_id: revisionId2,
        record_id: recordId2,
        created: new Date().toISOString(),
        created_by: 'test-user',
      });

      await engine.core.createRevision({
        _id: revisionId2,
        revision_format_version: 1,
        avps: {'First-2': avpId2},
        record_id: recordId2,
        parents: [],
        created: new Date().toISOString(),
        created_by: 'test-user',
        type: 'B',
        relationship: {},
      });

      // Retrieve multiple records
      const hydrated = await engine.hydrated.getHydratedRecords([
        recordId1,
        recordId2,
      ]);

      expect(hydrated).toHaveLength(2);
      expect(hydrated[0].record._id).toBe(recordId1);
      expect(hydrated[1].record._id).toBe(recordId2);
      expect(hydrated[0].data['First-1'].data).toBe('Record 1 data');
      expect(hydrated[1].data['First-2'].data).toBe('Record 2 data');
    });

    test('should retrieve specific revision when specified', async () => {
      const recordId = generateRecordID();
      const revision1Id = generateRevisionID();
      const revision2Id = generateRevisionID();
      const avp1Id = generateAvpID();
      const avp2Id = generateAvpID();

      // Create record with two revisions
      await engine.core.createRecord({
        _id: recordId,
        record_format_version: 1,
        created: new Date().toISOString(),
        created_by: 'test-user',
        revisions: [revision1Id, revision2Id],
        heads: [revision2Id], // revision2 is the head
        type: 'A',
      });

      // Create first revision
      await engine.core.createAvp({
        _id: avp1Id,
        avp_format_version: 1,
        type: 'faims-core::String',
        data: 'Old value',
        revision_id: revision1Id,
        record_id: recordId,
        created: new Date().toISOString(),
        created_by: 'test-user',
      });

      await engine.core.createRevision({
        _id: revision1Id,
        revision_format_version: 1,
        avps: {'First-1': avp1Id},
        record_id: recordId,
        parents: [],
        created: new Date().toISOString(),
        created_by: 'test-user',
        type: 'A',
        relationship: {},
      });

      // Create second revision
      await engine.core.createAvp({
        _id: avp2Id,
        avp_format_version: 1,
        type: 'faims-core::String',
        data: 'New value',
        revision_id: revision2Id,
        record_id: recordId,
        created: new Date().toISOString(),
        created_by: 'test-user',
      });

      await engine.core.createRevision({
        _id: revision2Id,
        revision_format_version: 1,
        avps: {'First-1': avp2Id},
        record_id: recordId,
        parents: [revision1Id],
        created: new Date().toISOString(),
        created_by: 'test-user',
        type: 'A',
        relationship: {},
      });

      // Retrieve specific old revision
      const hydratedOld = await engine.hydrated.getHydratedRecord({
        recordId,
        revisionId: revision1Id,
      });

      expect(hydratedOld.revision._id).toBe(revision1Id);
      expect(hydratedOld.data['First-1'].data).toBe('Old value');

      // Retrieve head (default)
      const hydratedNew = await engine.hydrated.getHydratedRecord({
        recordId,
      });

      expect(hydratedNew.revision._id).toBe(revision2Id);
      expect(hydratedNew.data['First-1'].data).toBe('New value');
    });

    test('should include attachment information in hydrated data', async () => {
      const recordId = generateRecordID();
      const revisionId = generateRevisionID();
      const avpId = generateAvpID();
      const attachmentId = generateAttID();

      // Create attachment
      const testData = Buffer.from('test content').toString('base64');
      await engine.core.createAttachment({
        _id: attachmentId,
        attach_format_version: 1,
        avp_id: avpId,
        revision_id: revisionId,
        record_id: recordId,
        created: new Date().toISOString(),
        created_by: 'test-user',
        filename: 'test.txt',
        _attachments: {
          'test.txt': {
            content_type: 'text/plain',
            data: testData,
          },
        },
      });

      // Create record
      await engine.core.createRecord({
        _id: recordId,
        record_format_version: 1,
        created: new Date().toISOString(),
        created_by: 'test-user',
        revisions: [revisionId],
        heads: [revisionId],
        type: 'A',
      });

      // Create AVP with attachment reference
      await engine.core.createAvp({
        _id: avpId,
        avp_format_version: 1,
        type: 'faims-core::String',
        data: 'Field with attachment',
        revision_id: revisionId,
        record_id: recordId,
        created: new Date().toISOString(),
        created_by: 'test-user',
        faims_attachments: [
          {
            attachment_id: attachmentId,
            filename: 'test.txt',
            file_type: 'text/plain',
          },
        ],
      });

      await engine.core.createRevision({
        _id: revisionId,
        revision_format_version: 1,
        avps: {'First-1': avpId},
        record_id: recordId,
        parents: [],
        created: new Date().toISOString(),
        created_by: 'test-user',
        type: 'A',
        relationship: {},
      });

      // Hydrate the record
      const hydrated = await engine.hydrated.getHydratedRecord({
        recordId,
      });

      expect(hydrated.data['First-1'].faimsAttachments).toHaveLength(1);
      expect(hydrated.data['First-1'].faimsAttachments?.[0].attachmentId).toBe(
        attachmentId
      );
      expect(hydrated.data['First-1'].faimsAttachments?.[0].filename).toBe(
        'test.txt'
      );
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

    test('should create new AVPs when annotations change', async () => {
      // Create initial record
      const formRecord: NewFormRecord = {
        formId: 'A',
        createdBy: 'test-user',
        data: {
          'First-1': 'Same value',
        },
        annotations: {
          'First-1': {
            annotation: 'Initial annotation',
            uncertainty: false,
          },
        },
      };

      const initialRevisionId = await engine.form.createRecord(formRecord);
      const initialRevision = await engine.core.getRevision(initialRevisionId);
      const recordId = initialRevision.record_id;

      // Get the initial AVP ID
      const initialAvpId = initialRevision.avps['First-1'];

      // Update with same data but different annotation
      const updateFormRecord: ExistingFormRecord = {
        recordId,
        revisionId: initialRevisionId,
        formId: 'A',
        createdBy: 'test-user',
        data: {
          'First-1': 'Same value', // Same value
        },
        annotations: {
          'First-1': {
            annotation: 'Updated annotation', // Different annotation
            uncertainty: true,
          },
        },
      };

      const newRevisionId = await engine.form.updateRecord(updateFormRecord, {
        updatedBy: 'test-user',
      });

      const newRevision = await engine.core.getRevision(newRevisionId);

      // The AVP ID should be different because annotation changed
      expect(newRevision.avps['First-1']).not.toBe(initialAvpId);
    });

    test('should create record with relationship', async () => {
      // First create a parent record
      const parentFormRecord: NewFormRecord = {
        formId: 'A',
        createdBy: 'test-user',
        data: {
          'First-1': 'Parent value',
        },
        annotations: {},
      };

      const parentRevisionId = await engine.form.createRecord(parentFormRecord);
      const parentRevision = await engine.core.getRevision(parentRevisionId);
      const parentRecordId = parentRevision.record_id;

      // Create a child record with relationship
      const childFormRecord: NewFormRecord = {
        formId: 'B',
        createdBy: 'test-user',
        data: {
          'First-2': 'Child value',
        },
        annotations: {},
        relationship: {
          parent: {
            recordId: parentRecordId,
            fieldId: 'First-1',
            relationTypeVocabPair: ['parent', 'child'],
          },
        },
      };

      const childRevisionId = await engine.form.createRecord(childFormRecord);
      const childRevision = await engine.core.getRevision(childRevisionId);

      expect(childRevision.relationship).toEqual({
        parent: {
          record_id: parentRecordId,
          field_id: 'First-1',
          relation_type_vocabPair: ['parent', 'child'],
        },
      });
    });

    test('should handle multiple sequential updates', async () => {
      // Create initial record
      const formRecord: NewFormRecord = {
        formId: 'A',
        createdBy: 'test-user',
        data: {
          'First-1': 'Version 1',
          'Second-1': 'Data 1',
        },
        annotations: {},
      };

      const revision1Id = await engine.form.createRecord(formRecord);
      const revision1 = await engine.core.getRevision(revision1Id);
      const recordId = revision1.record_id;

      // First update
      const update1: ExistingFormRecord = {
        recordId,
        revisionId: revision1Id,
        formId: 'A',
        createdBy: 'test-user',
        data: {
          'First-1': 'Version 2',
          'Second-1': 'Data 1',
        },
        annotations: {},
      };

      const revision2Id = await engine.form.updateRecord(update1, {
        updatedBy: 'test-user-2',
      });

      // Second update
      const update2: ExistingFormRecord = {
        recordId,
        revisionId: revision2Id,
        formId: 'A',
        createdBy: 'test-user',
        data: {
          'First-1': 'Version 3',
          'Second-1': 'Data 2',
        },
        annotations: {},
      };

      const revision3Id = await engine.form.updateRecord(update2, {
        updatedBy: 'test-user-3',
      });

      // Verify revision history
      const record = await engine.core.getRecord(recordId);
      expect(record.revisions).toHaveLength(3);
      expect(record.heads).toEqual([revision3Id]);

      // Verify final data
      const hydrated = await engine.hydrated.getHydratedRecord({
        recordId,
      });
      expect(hydrated.data['First-1'].data).toBe('Version 3');
      expect(hydrated.data['Second-1'].data).toBe('Data 2');
    });

    test('should handle empty data fields', async () => {
      const formRecord: NewFormRecord = {
        formId: 'A',
        createdBy: 'test-user',
        data: {
          'First-1': '',
          'Second-1': null,
        },
        annotations: {},
      };

      const revisionId = await engine.form.createRecord(formRecord);

      const existingFormRecord = await engine.form.getExistingFormRecord({
        recordId: (await engine.core.getRevision(revisionId)).record_id,
      });

      expect(existingFormRecord.data['First-1']).toBe('');
      expect(existingFormRecord.data['Second-1']).toBe(null);
    });

    test('should update record heads correctly', async () => {
      // Create initial record
      const formRecord: NewFormRecord = {
        formId: 'A',
        createdBy: 'test-user',
        data: {
          'First-1': 'Initial',
        },
        annotations: {},
      };

      const revision1Id = await engine.form.createRecord(formRecord);
      const revision1 = await engine.core.getRevision(revision1Id);
      const recordId = revision1.record_id;

      // Verify initial state
      let record = await engine.core.getRecord(recordId);
      expect(record.heads).toEqual([revision1Id]);

      // Update
      const update: ExistingFormRecord = {
        recordId,
        revisionId: revision1Id,
        formId: 'A',
        createdBy: 'test-user',
        data: {
          'First-1': 'Updated',
        },
        annotations: {},
      };

      const revision2Id = await engine.form.updateRecord(update, {
        updatedBy: 'test-user',
      });

      // Verify updated state
      record = await engine.core.getRecord(recordId);
      expect(record.heads).toEqual([revision2Id]);
      expect(record.heads).not.toContain(revision1Id);
      expect(record.revisions).toContain(revision1Id);
      expect(record.revisions).toContain(revision2Id);
    });
  });
});
