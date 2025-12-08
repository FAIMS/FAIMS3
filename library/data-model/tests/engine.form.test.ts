import * as fs from 'fs';
import * as path from 'path';
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import {
  DatabaseInterface,
  DataDocument,
  DataEngine,
  EncodedUISpecification,
  generateAttID,
  generateAvpID,
  NewFormRecord,
  UISpecification,
} from '../src';

// Setup PouchDB plugins
PouchDB.plugin(PouchDBFind);
PouchDB.plugin(require('pouchdb-adapter-memory'));

describe('Form Operations', () => {
  let db: DatabaseInterface<DataDocument>;
  let engine: DataEngine;
  const databaseName = 'test-form-db';

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

  describe('createRecord', () => {
    test('should create record and revision successfully', async () => {
      const formRecord: NewFormRecord = {
        formId: 'A',
        createdBy: 'test-user',
      };

      const result = await engine.form.createRecord(formRecord);

      expect(result.record._id).toBeDefined();
      expect(result.record._rev).toBeDefined();
      expect(result.record.type).toBe('A');
      expect(result.record.created_by).toBe('test-user');
      expect(result.record.created).toBeDefined();

      expect(result.revision._id).toBeDefined();
      expect(result.revision._rev).toBeDefined();
      expect(result.revision.type).toBe('A');
      expect(result.revision.created_by).toBe('test-user');
      expect(result.revision.record_id).toBe(result.record._id);
    });

    test('should create record with no AVPs initially', async () => {
      const formRecord: NewFormRecord = {
        formId: 'A',
        createdBy: 'test-user',
      };

      const result = await engine.form.createRecord(formRecord);

      // Check revision has empty AVPs map
      expect(result.revision.avps).toEqual({});
      expect(Object.keys(result.revision.avps).length).toBe(0);
    });

    test('should link record and revision correctly', async () => {
      const formRecord: NewFormRecord = {
        formId: 'B',
        createdBy: 'test-user',
      };

      const result = await engine.form.createRecord(formRecord);

      // Record should have this revision in heads and revisions
      expect(result.record.heads).toContain(result.revision._id);
      expect(result.record.revisions).toContain(result.revision._id);
      expect(result.record.heads).toHaveLength(1);
      expect(result.record.revisions).toHaveLength(1);

      // Revision should point to this record
      expect(result.revision.record_id).toBe(result.record._id);
    });

    test('should create record with relationship', async () => {
      // Create parent record first
      const parentResult = await engine.form.createRecord({
        formId: 'A',
        createdBy: 'test-user',
      });

      // Create child with relationship
      const childRecord: NewFormRecord = {
        formId: 'B',
        createdBy: 'test-user',
        relationship: {
          parent: {
            recordId: parentResult.record._id,
            fieldId: 'test-field',
            relationTypeVocabPair: ['parent', 'child'],
          },
        },
      };

      const childResult = await engine.form.createRecord(childRecord);

      expect(childResult.revision.relationship).toEqual({
        parent: {
          record_id: parentResult.record._id,
          field_id: 'test-field',
          relation_type_vocabPair: ['parent', 'child'],
        },
      });
    });

    test('should set created timestamp', async () => {
      const beforeCreate = new Date();

      const result = await engine.form.createRecord({
        formId: 'A',
        createdBy: 'test-user',
      });

      const afterCreate = new Date();

      const recordCreated = new Date(result.record.created);
      const revisionCreated = new Date(result.revision.created);

      expect(recordCreated.getTime()).toBeGreaterThanOrEqual(
        beforeCreate.getTime()
      );
      expect(recordCreated.getTime()).toBeLessThanOrEqual(
        afterCreate.getTime()
      );
      expect(revisionCreated.getTime()).toBeGreaterThanOrEqual(
        beforeCreate.getTime()
      );
      expect(revisionCreated.getTime()).toBeLessThanOrEqual(
        afterCreate.getTime()
      );
    });
  });

  describe('createRevision', () => {
    test('should create child revision from parent', async () => {
      // Create initial record and revision
      const initialResult = await engine.form.createRecord({
        formId: 'A',
        createdBy: 'user-1',
      });

      const parentRevisionId = initialResult.revision._id;
      const recordId = initialResult.record._id;

      // Create child revision
      const childRevision = await engine.form.createRevision({
        recordId,
        revisionId: parentRevisionId,
        createdBy: 'user-2',
      });

      expect(childRevision._id).toBeDefined();
      expect(childRevision._id).not.toBe(parentRevisionId);
      expect(childRevision._rev).toBeDefined();
      expect(childRevision.record_id).toBe(recordId);
    });

    test('should copy AVPs from parent revision', async () => {
      // Create record with initial data
      const initialResult = await engine.form.createRecord({
        formId: 'A',
        createdBy: 'user-1',
      });

      // Add some AVPs to the revision
      const avpId1 = generateAvpID();
      const avpId2 = generateAvpID();

      await engine.core.createAvp({
        _id: avpId1,
        avp_format_version: 1,
        type: 'faims-core::String',
        data: 'test value 1',
        revision_id: initialResult.revision._id,
        record_id: initialResult.record._id,
        created: new Date().toISOString(),
        created_by: 'user-1',
      });

      await engine.core.createAvp({
        _id: avpId2,
        avp_format_version: 1,
        type: 'faims-core::String',
        data: 'test value 2',
        revision_id: initialResult.revision._id,
        record_id: initialResult.record._id,
        created: new Date().toISOString(),
        created_by: 'user-1',
      });

      // Update parent revision to include these AVPs
      await engine.core.updateRevision({
        ...initialResult.revision,
        avps: {
          'field-1': avpId1,
          'field-2': avpId2,
        },
      });

      // Create child revision
      const childRevision = await engine.form.createRevision({
        recordId: initialResult.record._id,
        revisionId: initialResult.revision._id,
        createdBy: 'user-2',
      });

      // Child should have same AVP map
      expect(childRevision.avps).toEqual({
        'field-1': avpId1,
        'field-2': avpId2,
      });
    });

    test('should set parent correctly', async () => {
      const initialResult = await engine.form.createRecord({
        formId: 'A',
        createdBy: 'user-1',
      });

      const childRevision = await engine.form.createRevision({
        recordId: initialResult.record._id,
        revisionId: initialResult.revision._id,
        createdBy: 'user-2',
      });

      expect(childRevision.parents).toContain(initialResult.revision._id);
      expect(childRevision.parents).toHaveLength(1);
    });

    test('should update created timestamp', async () => {
      const initialResult = await engine.form.createRecord({
        formId: 'A',
        createdBy: 'user-1',
      });

      const parentCreated = new Date(initialResult.revision.created);

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const childRevision = await engine.form.createRevision({
        recordId: initialResult.record._id,
        revisionId: initialResult.revision._id,
        createdBy: 'user-2',
      });

      const childCreated = new Date(childRevision.created);

      expect(childCreated.getTime()).toBeGreaterThan(parentCreated.getTime());
    });

    test('should update createdBy to new user', async () => {
      const initialResult = await engine.form.createRecord({
        formId: 'A',
        createdBy: 'user-1',
      });

      const childRevision = await engine.form.createRevision({
        recordId: initialResult.record._id,
        revisionId: initialResult.revision._id,
        createdBy: 'user-2',
      });

      expect(initialResult.revision.created_by).toBe('user-1');
      expect(childRevision.created_by).toBe('user-2');
    });

    test('should update record heads', async () => {
      const initialResult = await engine.form.createRecord({
        formId: 'A',
        createdBy: 'user-1',
      });

      const oldHeadId = initialResult.revision._id;

      const childRevision = await engine.form.createRevision({
        recordId: initialResult.record._id,
        revisionId: oldHeadId,
        createdBy: 'user-2',
      });

      const updatedRecord = await engine.core.getRecord(
        initialResult.record._id
      );

      // Old head should be removed, new head added
      expect(updatedRecord.heads).not.toContain(oldHeadId);
      expect(updatedRecord.heads).toContain(childRevision._id);
      expect(updatedRecord.heads).toHaveLength(1);

      // Both revisions should be in revisions list
      expect(updatedRecord.revisions).toContain(oldHeadId);
      expect(updatedRecord.revisions).toContain(childRevision._id);
      expect(updatedRecord.revisions).toHaveLength(2);
    });

    test('should throw error if revision does not belong to record', async () => {
      const record1 = await engine.form.createRecord({
        formId: 'A',
        createdBy: 'user-1',
      });

      const record2 = await engine.form.createRecord({
        formId: 'A',
        createdBy: 'user-1',
      });

      // Try to create revision using wrong record ID
      await expect(
        engine.form.createRevision({
          recordId: record1.record._id,
          revisionId: record2.revision._id, // Wrong revision!
          createdBy: 'user-2',
        })
      ).rejects.toThrow();
    });

    test('should preserve relationship from parent', async () => {
      const parentRecord = await engine.form.createRecord({
        formId: 'A',
        createdBy: 'user-1',
      });

      const childRecord = await engine.form.createRecord({
        formId: 'B',
        createdBy: 'user-1',
        relationship: {
          parent: {
            recordId: parentRecord.record._id,
            fieldId: 'test-field',
            relationTypeVocabPair: ['parent', 'child'],
          },
        },
      });

      const newRevision = await engine.form.createRevision({
        recordId: childRecord.record._id,
        revisionId: childRecord.revision._id,
        createdBy: 'user-2',
      });

      expect(newRevision.relationship).toEqual(
        childRecord.revision.relationship
      );
    });
  });

  describe('updateRevision - new mode (no parent)', () => {
    test('should validate that new mode has no parents', async () => {
      // Create a record with parent
      const initialResult = await engine.form.createRecord({
        formId: 'A',
        createdBy: 'user-1',
      });

      // Create a child revision (which has a parent)
      const childRevision = await engine.form.createRevision({
        recordId: initialResult.record._id,
        revisionId: initialResult.revision._id,
        createdBy: 'user-2',
      });

      // Try to update with 'new' mode when there's a parent
      await expect(
        engine.form.updateRevision({
          revisionId: childRevision._id,
          recordId: initialResult.record._id,
          update: {
            'First-1': {
              data: 'test',
            },
          },
          mode: 'new',
          updatedBy: 'user-3',
        })
      ).rejects.toThrow();
    });

    test('should not create revision when no changes (new mode)', async () => {
      const initialResult = await engine.form.createRecord({
        formId: 'A',
        createdBy: 'user-1',
      });

      const originalRev = initialResult.revision._rev;

      // Update with no actual changes
      const updatedRevision = await engine.form.updateRevision({
        revisionId: initialResult.revision._id,
        recordId: initialResult.record._id,
        update: {},
        mode: 'new',
        updatedBy: 'user-1',
      });

      // Should return same revision without change
      expect(updatedRevision._id).toBe(initialResult.revision._id);
      expect(updatedRevision._rev).toBe(originalRev);
    });

    test('should create new AVPs on first data change (new mode)', async () => {
      const initialResult = await engine.form.createRecord({
        formId: 'A',
        createdBy: 'user-1',
      });

      // First update - should create new AVPs
      const updatedRevision = await engine.form.updateRevision({
        revisionId: initialResult.revision._id,
        recordId: initialResult.record._id,
        update: {
          'First-1': {
            data: 'first value',
          },
          'Second-1': {
            data: 'second value',
          },
        },
        mode: 'new',
        updatedBy: 'user-1',
      });

      // Should have new revision
      expect(updatedRevision._rev).not.toBe(initialResult.revision._rev);

      // Should have created AVPs
      expect(Object.keys(updatedRevision.avps)).toHaveLength(2);
      expect(updatedRevision.avps['First-1']).toBeDefined();
      expect(updatedRevision.avps['Second-1']).toBeDefined();

      // Verify AVPs exist and have correct data
      const avp1 = await engine.core.getAvp(updatedRevision.avps['First-1']);
      const avp2 = await engine.core.getAvp(updatedRevision.avps['Second-1']);

      expect(avp1.data).toBe('first value');
      expect(avp2.data).toBe('second value');
    });

    test('should update AVPs in place on subsequent changes (new mode)', async () => {
      const initialResult = await engine.form.createRecord({
        formId: 'A',
        createdBy: 'user-1',
      });

      // First update - creates AVPs
      const rev1 = await engine.form.updateRevision({
        revisionId: initialResult.revision._id,
        recordId: initialResult.record._id,
        update: {
          'First-1': {
            data: 'initial value',
          },
        },
        mode: 'new',
        updatedBy: 'user-1',
      });

      const firstAvpId = rev1.avps['First-1'];

      // Second update - should update in place
      const rev2 = await engine.form.updateRevision({
        revisionId: rev1._id,
        recordId: initialResult.record._id,
        update: {
          'First-1': {
            data: 'updated value',
          },
        },
        mode: 'new',
        updatedBy: 'user-1',
      });

      // AVP ID should be the same (in-place update)
      expect(rev2.avps['First-1']).toBe(firstAvpId);

      // But the data should be updated
      const updatedAvp = await engine.core.getAvp(firstAvpId);
      expect(updatedAvp.data).toBe('updated value');
    });

    test('should handle annotation changes (new mode)', async () => {
      const initialResult = await engine.form.createRecord({
        formId: 'A',
        createdBy: 'user-1',
      });

      // First update with data and annotation
      const rev1 = await engine.form.updateRevision({
        revisionId: initialResult.revision._id,
        recordId: initialResult.record._id,
        update: {
          'First-1': {
            data: 'test value',
            annotation: {
              annotation: 'initial note',
              uncertainty: false,
            },
          },
        },
        mode: 'new',
        updatedBy: 'user-1',
      });

      const firstAvpId = rev1.avps['First-1'];

      // Update annotation only
      const rev2 = await engine.form.updateRevision({
        revisionId: rev1._id,
        recordId: initialResult.record._id,
        update: {
          'First-1': {
            data: 'test value',
            annotation: {
              annotation: 'updated note',
              uncertainty: true,
            },
          },
        },
        mode: 'new',
        updatedBy: 'user-1',
      });

      // Should still be in-place update (same AVP ID)
      expect(rev2.avps['First-1']).toBe(firstAvpId);

      // Verify annotation was updated
      const updatedAvp = await engine.core.getAvp(firstAvpId);
      expect(updatedAvp.annotations?.annotation).toBe('updated note');
      expect(updatedAvp.annotations?.uncertainty).toBe(true);
    });

    test('should handle attachment changes (new mode)', async () => {
      const initialResult = await engine.form.createRecord({
        formId: 'A',
        createdBy: 'user-1',
      });

      const attachmentId1 = generateAttID();
      const attachmentId2 = generateAttID();

      // First update with attachment
      const rev1 = await engine.form.updateRevision({
        revisionId: initialResult.revision._id,
        recordId: initialResult.record._id,
        update: {
          'First-1': {
            data: 'test value',
            attachments: [
              {
                attachmentId: attachmentId1,
                filename: 'file1.txt',
                fileType: 'text/plain',
              },
            ],
          },
        },
        mode: 'new',
        updatedBy: 'user-1',
      });

      const firstAvpId = rev1.avps['First-1'];

      // Update attachments
      const rev2 = await engine.form.updateRevision({
        revisionId: rev1._id,
        recordId: initialResult.record._id,
        update: {
          'First-1': {
            data: 'test value',
            attachments: [
              {
                attachmentId: attachmentId1,
                filename: 'file1.txt',
                fileType: 'text/plain',
              },
              {
                attachmentId: attachmentId2,
                filename: 'file2.txt',
                fileType: 'text/plain',
              },
            ],
          },
        },
        mode: 'new',
        updatedBy: 'user-1',
      });

      // Should be in-place update
      expect(rev2.avps['First-1']).toBe(firstAvpId);

      // Verify attachments were updated
      const updatedAvp = await engine.core.getAvp(firstAvpId);
      expect(updatedAvp.faims_attachments).toHaveLength(2);
    });

    test('should handle removing fields (new mode)', async () => {
      const initialResult = await engine.form.createRecord({
        formId: 'A',
        createdBy: 'user-1',
      });

      // Add two fields
      const rev1 = await engine.form.updateRevision({
        revisionId: initialResult.revision._id,
        recordId: initialResult.record._id,
        update: {
          'First-1': {data: 'value 1'},
          'Second-1': {data: 'value 2'},
        },
        mode: 'new',
        updatedBy: 'user-1',
      });

      expect(Object.keys(rev1.avps)).toHaveLength(2);

      // Remove one field by not including it
      const rev2 = await engine.form.updateRevision({
        revisionId: rev1._id,
        recordId: initialResult.record._id,
        update: {
          'First-1': {data: 'value 1'},
          // Second-1 not included = removed
        },
        mode: 'new',
        updatedBy: 'user-1',
      });

      // Should only have one field now
      expect(Object.keys(rev2.avps)).toHaveLength(1);
      expect(rev2.avps['First-1']).toBeDefined();
      expect(rev2.avps['Second-1']).toBeUndefined();
    });
  });

  describe('updateRevision - parent mode (with parent)', () => {
    test('should validate that parent mode has exactly one parent', async () => {
      // Create initial record (no parent)
      const initialResult = await engine.form.createRecord({
        formId: 'A',
        createdBy: 'user-1',
      });

      // Try to update with 'parent' mode when there's no parent
      await expect(
        engine.form.updateRevision({
          revisionId: initialResult.revision._id,
          recordId: initialResult.record._id,
          update: {
            'First-1': {data: 'test'},
          },
          mode: 'parent',
          updatedBy: 'user-1',
        })
      ).rejects.toThrow();
    });

    test('should create new AVP on first change from parent (parent mode)', async () => {
      const initialResult = await engine.form.createRecord({
        formId: 'A',
        createdBy: 'user-1',
      });

      // Set initial data on parent
      const parentRev = await engine.form.updateRevision({
        revisionId: initialResult.revision._id,
        recordId: initialResult.record._id,
        update: {
          'First-1': {data: 'parent value'},
        },
        mode: 'new',
        updatedBy: 'user-1',
      });

      const parentAvpId = parentRev.avps['First-1'];

      // Create child revision
      const childRev = await engine.form.createRevision({
        recordId: initialResult.record._id,
        revisionId: parentRev._id,
        createdBy: 'user-2',
      });

      // Child should start with parent's AVP
      expect(childRev.avps['First-1']).toBe(parentAvpId);

      // Update child - should create NEW AVP (not in-place)
      const updatedChildRev = await engine.form.updateRevision({
        revisionId: childRev._id,
        recordId: initialResult.record._id,
        update: {
          'First-1': {data: 'child value'},
        },
        mode: 'parent',
        updatedBy: 'user-2',
      });

      // AVP ID should be different (new AVP created)
      expect(updatedChildRev.avps['First-1']).not.toBe(parentAvpId);

      // Parent AVP should be unchanged
      const parentAvp = await engine.core.getAvp(parentAvpId);
      expect(parentAvp.data).toBe('parent value');

      // Child AVP should have new value
      const childAvp = await engine.core.getAvp(
        updatedChildRev.avps['First-1']
      );
      expect(childAvp.data).toBe('child value');
    });

    test('should update AVP in place on subsequent changes (parent mode)', async () => {
      const initialResult = await engine.form.createRecord({
        formId: 'A',
        createdBy: 'user-1',
      });

      // Set initial data on parent
      const parentRev = await engine.form.updateRevision({
        revisionId: initialResult.revision._id,
        recordId: initialResult.record._id,
        update: {
          'First-1': {data: 'parent value'},
        },
        mode: 'new',
        updatedBy: 'user-1',
      });

      // Create child revision
      const childRev = await engine.form.createRevision({
        recordId: initialResult.record._id,
        revisionId: parentRev._id,
        createdBy: 'user-2',
      });

      // First update - creates new AVP
      const childRev1 = await engine.form.updateRevision({
        revisionId: childRev._id,
        recordId: initialResult.record._id,
        update: {
          'First-1': {data: 'child value 1'},
        },
        mode: 'parent',
        updatedBy: 'user-2',
      });

      const childAvpId = childRev1.avps['First-1'];

      // Second update - should update in place
      const childRev2 = await engine.form.updateRevision({
        revisionId: childRev1._id,
        recordId: initialResult.record._id,
        update: {
          'First-1': {data: 'child value 2'},
        },
        mode: 'parent',
        updatedBy: 'user-2',
      });

      // AVP ID should be the same (in-place update)
      expect(childRev2.avps['First-1']).toBe(childAvpId);

      // Data should be updated
      const updatedAvp = await engine.core.getAvp(childAvpId);
      expect(updatedAvp.data).toBe('child value 2');
    });

    test('should reuse parent AVP when reverting to parent value (parent mode)', async () => {
      const initialResult = await engine.form.createRecord({
        formId: 'A',
        createdBy: 'user-1',
      });

      // Set initial data on parent
      const parentRev = await engine.form.updateRevision({
        revisionId: initialResult.revision._id,
        recordId: initialResult.record._id,
        update: {
          'First-1': {data: 'parent value'},
        },
        mode: 'new',
        updatedBy: 'user-1',
      });

      const parentAvpId = parentRev.avps['First-1'];

      // Create child revision
      const childRev = await engine.form.createRevision({
        recordId: initialResult.record._id,
        revisionId: parentRev._id,
        createdBy: 'user-2',
      });

      // Change to different value - creates new AVP
      const childRev1 = await engine.form.updateRevision({
        revisionId: childRev._id,
        recordId: initialResult.record._id,
        update: {
          'First-1': {data: 'child value'},
        },
        mode: 'parent',
        updatedBy: 'user-2',
      });

      expect(childRev1.avps['First-1']).not.toBe(parentAvpId);

      // Revert to parent value - should reuse parent AVP
      const childRev2 = await engine.form.updateRevision({
        revisionId: childRev1._id,
        recordId: initialResult.record._id,
        update: {
          'First-1': {data: 'parent value'},
        },
        mode: 'parent',
        updatedBy: 'user-2',
      });

      // Should reuse parent AVP ID
      expect(childRev2.avps['First-1']).toBe(parentAvpId);
    });

    test('should handle mixed scenario - unchanged, changed, and new fields (parent mode)', async () => {
      const initialResult = await engine.form.createRecord({
        formId: 'A',
        createdBy: 'user-1',
      });

      // Set initial data on parent
      const parentRev = await engine.form.updateRevision({
        revisionId: initialResult.revision._id,
        recordId: initialResult.record._id,
        update: {
          'First-1': {data: 'parent value 1'},
          'Second-1': {data: 'parent value 2'},
        },
        mode: 'new',
        updatedBy: 'user-1',
      });

      const parentAvp1Id = parentRev.avps['First-1'];
      const parentAvp2Id = parentRev.avps['Second-1'];

      // Create child revision
      const childRev = await engine.form.createRevision({
        recordId: initialResult.record._id,
        revisionId: parentRev._id,
        createdBy: 'user-2',
      });

      // Update child with:
      // - First-1: unchanged (should keep parent AVP)
      // - Second-1: changed (should create new AVP)
      // - Third-1: new field (should create new AVP)
      const updatedChildRev = await engine.form.updateRevision({
        revisionId: childRev._id,
        recordId: initialResult.record._id,
        update: {
          'First-1': {data: 'parent value 1'}, // Unchanged
          'Second-1': {data: 'child value 2'}, // Changed
          'Third-1': {data: 'new value 3'}, // New
        },
        mode: 'parent',
        updatedBy: 'user-2',
      });

      // First-1 should still use parent AVP (unchanged)
      expect(updatedChildRev.avps['First-1']).toBe(parentAvp1Id);

      // Second-1 should have new AVP (changed)
      expect(updatedChildRev.avps['Second-1']).not.toBe(parentAvp2Id);

      // Third-1 should have new AVP (new field)
      expect(updatedChildRev.avps['Third-1']).toBeDefined();

      // Verify data
      const avp1 = await engine.core.getAvp(updatedChildRev.avps['First-1']);
      const avp2 = await engine.core.getAvp(updatedChildRev.avps['Second-1']);
      const avp3 = await engine.core.getAvp(updatedChildRev.avps['Third-1']);

      expect(avp1.data).toBe('parent value 1');
      expect(avp2.data).toBe('child value 2');
      expect(avp3.data).toBe('new value 3');
    });

    test('should handle annotation changes independently (parent mode)', async () => {
      const initialResult = await engine.form.createRecord({
        formId: 'A',
        createdBy: 'user-1',
      });

      // Set initial data on parent with annotation
      const parentRev = await engine.form.updateRevision({
        revisionId: initialResult.revision._id,
        recordId: initialResult.record._id,
        update: {
          'First-1': {
            data: 'value',
            annotation: {annotation: 'parent note', uncertainty: false},
          },
        },
        mode: 'new',
        updatedBy: 'user-1',
      });

      const parentAvpId = parentRev.avps['First-1'];

      // Create child revision
      const childRev = await engine.form.createRevision({
        recordId: initialResult.record._id,
        revisionId: parentRev._id,
        createdBy: 'user-2',
      });

      // Change annotation only (data same as parent)
      const childRev1 = await engine.form.updateRevision({
        revisionId: childRev._id,
        recordId: initialResult.record._id,
        update: {
          'First-1': {
            data: 'value',
            annotation: {annotation: 'child note', uncertainty: true},
          },
        },
        mode: 'parent',
        updatedBy: 'user-2',
      });

      // Should create new AVP (annotation is different)
      expect(childRev1.avps['First-1']).not.toBe(parentAvpId);

      const childAvp = await engine.core.getAvp(childRev1.avps['First-1']);
      expect(childAvp.annotations?.annotation).toBe('child note');
      expect(childAvp.annotations?.uncertainty).toBe(true);

      // Parent should be unchanged
      const parentAvp = await engine.core.getAvp(parentAvpId);
      expect(parentAvp.annotations?.annotation).toBe('parent note');
    });
  });

  describe('getExistingFormData', () => {
    test('should retrieve form data after creation', async () => {
      const initialResult = await engine.form.createRecord({
        formId: 'A',
        createdBy: 'user-1',
      });

      // Add some data
      await engine.form.updateRevision({
        revisionId: initialResult.revision._id,
        recordId: initialResult.record._id,
        update: {
          'First-1': {
            data: 'test value',
            annotation: {annotation: 'test note', uncertainty: true},
          },
        },
        mode: 'new',
        updatedBy: 'user-1',
      });

      const formData = await engine.form.getExistingFormData({
        recordId: initialResult.record._id,
      });

      expect(formData.data['First-1'].data).toBe('test value');
      expect(formData.data['First-1'].annotation?.annotation).toBe('test note');
      expect(formData.data['First-1'].annotation?.uncertainty).toBe(true);
    });

    test('should retrieve latest data after multiple updates', async () => {
      const initialResult = await engine.form.createRecord({
        formId: 'A',
        createdBy: 'user-1',
      });

      // Update 1
      const rev1 = await engine.form.updateRevision({
        revisionId: initialResult.revision._id,
        recordId: initialResult.record._id,
        update: {
          'First-1': {data: 'version 1'},
        },
        mode: 'new',
        updatedBy: 'user-1',
      });

      // Update 2
      const rev2 = await engine.form.updateRevision({
        revisionId: rev1._id,
        recordId: initialResult.record._id,
        update: {
          'First-1': {data: 'version 2'},
        },
        mode: 'new',
        updatedBy: 'user-1',
      });

      // Update 3
      await engine.form.updateRevision({
        revisionId: rev2._id,
        recordId: initialResult.record._id,
        update: {
          'First-1': {data: 'version 3'},
        },
        mode: 'new',
        updatedBy: 'user-1',
      });

      const formData = await engine.form.getExistingFormData({
        recordId: initialResult.record._id,
      });

      expect(formData.data['First-1'].data).toBe('version 3');
    });

    test('should retrieve specific revision data when specified', async () => {
      const initialResult = await engine.form.createRecord({
        formId: 'A',
        createdBy: 'user-1',
      });

      // Update 1
      const rev1 = await engine.form.updateRevision({
        revisionId: initialResult.revision._id,
        recordId: initialResult.record._id,
        update: {
          'First-1': {data: 'old value'},
        },
        mode: 'new',
        updatedBy: 'user-1',
      });

      // Then create a new version
      const res = await engine.form.createRevision({
        revisionId: rev1._id,
        recordId: initialResult.record._id,
        createdBy: 'user-1',
      });

      // Update 2
      await engine.form.updateRevision({
        revisionId: res._id,
        recordId: initialResult.record._id,
        update: {
          'First-1': {data: 'new value'},
        },
        mode: 'parent',
        updatedBy: 'user-1',
      });

      // Get old revision data
      const oldFormData = await engine.form.getExistingFormData({
        recordId: initialResult.record._id,
        revisionId: rev1._id,
      });

      expect(oldFormData.data['First-1'].data).toBe('old value');

      // Get latest (default)
      const latestFormData = await engine.form.getExistingFormData({
        recordId: initialResult.record._id,
      });

      expect(latestFormData.data['First-1'].data).toBe('new value');
    });

    test('should include attachment information', async () => {
      const initialResult = await engine.form.createRecord({
        formId: 'A',
        createdBy: 'user-1',
      });

      const attachmentId = generateAttID();

      await engine.form.updateRevision({
        revisionId: initialResult.revision._id,
        recordId: initialResult.record._id,
        update: {
          'First-1': {
            data: 'value',
            attachments: [
              {
                attachmentId,
                filename: 'test.txt',
                fileType: 'text/plain',
              },
            ],
          },
        },
        mode: 'new',
        updatedBy: 'user-1',
      });

      const formData = await engine.form.getExistingFormData({
        recordId: initialResult.record._id,
      });

      expect(formData.data['First-1'].attachments).toHaveLength(1);
      expect(formData.data['First-1'].attachments?.[0].attachmentId).toBe(
        attachmentId
      );
      expect(formData.data['First-1'].attachments?.[0].filename).toBe(
        'test.txt'
      );
    });

    test('should handle empty data', async () => {
      const initialResult = await engine.form.createRecord({
        formId: 'A',
        createdBy: 'user-1',
      });

      const formData = await engine.form.getExistingFormData({
        recordId: initialResult.record._id,
      });

      expect(Object.keys(formData.data)).toHaveLength(0);
    });

    test('should handle multiple fields with different types of data', async () => {
      const initialResult = await engine.form.createRecord({
        formId: 'A',
        createdBy: 'user-1',
      });

      const attachmentId = generateAttID();

      await engine.form.updateRevision({
        revisionId: initialResult.revision._id,
        recordId: initialResult.record._id,
        update: {
          'First-1': {
            data: 'simple string',
          },
          'Second-1': {
            data: 'with annotation',
            annotation: {annotation: 'note', uncertainty: false},
          },
          'Third-1': {
            data: 'with attachment',
            attachments: [
              {
                attachmentId,
                filename: 'file.txt',
                fileType: 'text/plain',
              },
            ],
          },
          'Fourth-1': {
            data: 'complete',
            annotation: {annotation: 'full', uncertainty: true},
            attachments: [
              {
                attachmentId,
                filename: 'complete.txt',
                fileType: 'text/plain',
              },
            ],
          },
        },
        mode: 'new',
        updatedBy: 'user-1',
      });

      const formData = await engine.form.getExistingFormData({
        recordId: initialResult.record._id,
      });

      expect(formData.data['First-1'].data).toBe('simple string');
      expect(formData.data['First-1'].annotation).toBeUndefined();
      expect(formData.data['First-1'].attachments).toBeUndefined();

      expect(formData.data['Second-1'].data).toBe('with annotation');
      expect(formData.data['Second-1'].annotation?.annotation).toBe('note');

      expect(formData.data['Third-1'].data).toBe('with attachment');
      expect(formData.data['Third-1'].attachments).toHaveLength(1);

      expect(formData.data['Fourth-1'].data).toBe('complete');
      expect(formData.data['Fourth-1'].annotation?.annotation).toBe('full');
      expect(formData.data['Fourth-1'].attachments).toHaveLength(1);
    });
  });
});
