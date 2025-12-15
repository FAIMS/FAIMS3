import * as fs from 'fs';
import * as path from 'path';
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import {
  DatabaseInterface,
  DataDocument,
  DataEngine,
  DEFAULT_VOCAB_PAIR,
  EncodedUISpecification,
  generateAttID,
  generateAvpID,
  generateRecordID,
  generateRevisionID,
  NewAvpDBDocument,
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
  const databaseName = 'test-db';

  // Load UI specification from JSON file
  const uiSpecPath = path.join(__dirname, 'engineTestUiSpec.json');
  const uiSpecData = fs.readFileSync(uiSpecPath, 'utf-8');
  const encodedSpec: EncodedUISpecification =
    JSON.parse(uiSpecData)['ui-specification'];
  const uiSpec: UISpecification = {
    fields: encodedSpec.fields,
    views: encodedSpec.fviews,
    viewsets: encodedSpec.viewsets,
    visible_types: encodedSpec.visible_types,
  };

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

    test('should fallback to default vocab pair when revision has empty relation_type_vocabPair', async () => {
      const recordId = generateRecordID();
      const revisionId = generateRevisionID();
      const parentRecordId = generateRecordID();

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

      // Create revision with empty vocab pair in relationship
      const revision: NewRevisionDBDocument = {
        _id: revisionId,
        revision_format_version: 1,
        avps: {},
        record_id: recordId,
        parents: [],
        created: new Date().toISOString(),
        created_by: 'test-user',
        type: 'A',
        relationship: {
          parent: {
            record_id: parentRecordId,
            field_id: 'some-field',
            relation_type_vocabPair: [], // Empty tuple - should trigger fallback
          },
        },
      };
      await engine.core.createRevision(revision);

      // Hydrate the record
      const hydrated = await engine.hydrated.getHydratedRecord({
        recordId,
      });

      // Verify the relationship exists and has the default vocab pair
      expect(hydrated.revision.relationship).toBeDefined();
      expect(hydrated.revision.relationship?.parent).toHaveLength(1);
      expect(
        hydrated.revision.relationship?.parent?.[0].relationTypeVocabPair
      ).toEqual(DEFAULT_VOCAB_PAIR);
      expect(hydrated.revision.relationship?.parent?.[0].recordId).toBe(
        parentRecordId
      );
      expect(hydrated.revision.relationship?.parent?.[0].fieldId).toBe(
        'some-field'
      );
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

    test('should update a revision using hydrated types', async () => {
      // Create a complete record with revision
      const recordId = generateRecordID();
      const revisionId = generateRevisionID();
      const avpId = generateAvpID();

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

      // Create AVP
      await engine.core.createAvp({
        _id: avpId,
        avp_format_version: 1,
        type: 'faims-core::String',
        data: 'Test value',
        revision_id: revisionId,
        record_id: recordId,
        created: new Date().toISOString(),
        created_by: 'test-user',
      });

      // Create revision without relationship
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
      const hydrated = await engine.hydrated.getHydratedRecord({recordId});

      // Update the revision with a new relationship using hydrated types
      const parentRecordId = generateRecordID();
      const updatedRevision = await engine.hydrated.updateRevision({
        ...hydrated.revision,
        relationship: {
          parent: [
            {
              recordId: parentRecordId,
              fieldId: 'some-field',
              relationTypeVocabPair: ['is child of', 'is parent of'],
            },
          ],
        },
      });

      // Verify the update
      expect(updatedRevision._id).toBe(revisionId);
      expect(updatedRevision._rev).not.toBe(hydrated.revision._rev);
      expect(updatedRevision.relationship?.parent).toHaveLength(1);
      expect(updatedRevision.relationship?.parent?.[0].recordId).toBe(
        parentRecordId
      );
      expect(updatedRevision.relationship?.parent?.[0].fieldId).toBe(
        'some-field'
      );
      expect(
        updatedRevision.relationship?.parent?.[0].relationTypeVocabPair
      ).toEqual(['is child of', 'is parent of']);

      // Re-hydrate and verify persistence
      const rehydrated = await engine.hydrated.getHydratedRecord({recordId});
      expect(rehydrated.revision.relationship?.parent).toHaveLength(1);
      expect(rehydrated.revision.relationship?.parent?.[0].recordId).toBe(
        parentRecordId
      );
    });

    test('should update a revision to add linked relationships', async () => {
      // Create a complete record with revision
      const recordId = generateRecordID();
      const revisionId = generateRevisionID();
      const avpId = generateAvpID();

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

      // Create AVP
      await engine.core.createAvp({
        _id: avpId,
        avp_format_version: 1,
        type: 'faims-core::String',
        data: 'Test value',
        revision_id: revisionId,
        record_id: recordId,
        created: new Date().toISOString(),
        created_by: 'test-user',
      });

      // Create revision without relationship
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
      const hydrated = await engine.hydrated.getHydratedRecord({recordId});

      // Update with multiple linked relationships
      const linkedRecord1 = generateRecordID();
      const linkedRecord2 = generateRecordID();
      const updatedRevision = await engine.hydrated.updateRevision({
        ...hydrated.revision,
        relationship: {
          linked: [
            {
              recordId: linkedRecord1,
              fieldId: 'link-field-1',
              relationTypeVocabPair: ['is related to', 'is related to'],
            },
            {
              recordId: linkedRecord2,
              fieldId: 'link-field-2',
              relationTypeVocabPair: ['references', 'is referenced by'],
            },
          ],
        },
      });

      // Verify the update
      expect(updatedRevision.relationship?.linked).toHaveLength(2);
      expect(updatedRevision.relationship?.linked?.[0].recordId).toBe(
        linkedRecord1
      );
      expect(updatedRevision.relationship?.linked?.[1].recordId).toBe(
        linkedRecord2
      );

      // Re-hydrate and verify persistence
      const rehydrated = await engine.hydrated.getHydratedRecord({recordId});
      expect(rehydrated.revision.relationship?.linked).toHaveLength(2);
    });

    test('should preserve existing relationships when updating revision', async () => {
      // Create a complete record with existing relationship
      const recordId = generateRecordID();
      const revisionId = generateRevisionID();
      const avpId = generateAvpID();
      const existingParentId = generateRecordID();

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

      // Create AVP
      await engine.core.createAvp({
        _id: avpId,
        avp_format_version: 1,
        type: 'faims-core::String',
        data: 'Test value',
        revision_id: revisionId,
        record_id: recordId,
        created: new Date().toISOString(),
        created_by: 'test-user',
      });

      // Create revision with existing parent relationship
      await engine.core.createRevision({
        _id: revisionId,
        revision_format_version: 1,
        avps: {'First-1': avpId},
        record_id: recordId,
        parents: [],
        created: new Date().toISOString(),
        created_by: 'test-user',
        type: 'A',
        relationship: {
          parent: {
            record_id: existingParentId,
            field_id: 'existing-field',
            relation_type_vocabPair: ['existing', 'existing'],
          },
        },
      });

      // Hydrate the record
      const hydrated = await engine.hydrated.getHydratedRecord({recordId});

      // Verify existing relationship was loaded
      expect(hydrated.revision.relationship?.parent).toHaveLength(1);

      // Add a linked relationship while preserving parent
      const newLinkedId = generateRecordID();
      const updatedRevision = await engine.hydrated.updateRevision({
        ...hydrated.revision,
        relationship: {
          ...hydrated.revision.relationship,
          linked: [
            {
              recordId: newLinkedId,
              fieldId: 'new-link-field',
              relationTypeVocabPair: ['links to', 'linked from'],
            },
          ],
        },
      });

      // Verify both relationships exist
      expect(updatedRevision.relationship?.parent).toHaveLength(1);
      expect(updatedRevision.relationship?.parent?.[0].recordId).toBe(
        existingParentId
      );
      expect(updatedRevision.relationship?.linked).toHaveLength(1);
      expect(updatedRevision.relationship?.linked?.[0].recordId).toBe(
        newLinkedId
      );
    });
  });
});
