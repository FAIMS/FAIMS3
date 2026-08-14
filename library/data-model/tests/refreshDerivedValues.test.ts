/*
 * Copyright 2026 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: refreshDerivedValues.test.ts
 * Description:
 *   End-to-end tests for the pre-export refresh pass (#2245) against a
 *   memory-backed engine: stale parent-derived values are re-derived and
 *   written as a revision credited to the given user; unchanged records
 *   produce no revision.
 */

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import {
  CompiledNotebookUiSpec,
  DatabaseInterface,
  DataDocument,
  DataEngine,
  refreshDerivedValues,
} from '../src';
import {couchInitialiser, initDataDB} from '../src/data_storage';

PouchDB.plugin(PouchDBFind);
PouchDB.plugin(require('pouchdb-adapter-memory'));

// Grid-Square parents Layer. Layer carries all three parent-dependent kinds:
// a templated string, a computed field (compiled properties attached
// directly, as the notebook-load compile pass would), and a
// ParentFieldDisplay. Layer-Notes is a plain local field the pass must never
// touch.
const makeSpec = () => {
  const spec: any = {
    fields: {
      'Square-Name': {
        'component-namespace': 'faims-custom',
        'component-name': 'TextField',
        'type-returned': 'faims-core::String',
        'component-parameters': {},
      },
      'Square-Size': {
        'component-namespace': 'faims-custom',
        'component-name': 'NumberField',
        'type-returned': 'faims-core::Number',
        'component-parameters': {},
      },
      'Layer-Children': {
        'component-namespace': 'faims-custom',
        'component-name': 'RelatedRecordSelector',
        'type-returned': 'faims-core::Relationship',
        'component-parameters': {
          related_type: 'Layer',
          relation_type: 'faims-core::Child',
        },
      },
      'Layer-Name': {
        'component-namespace': 'faims-custom',
        'component-name': 'TemplatedStringField',
        'type-returned': 'faims-core::String',
        'component-parameters': {template: '{{_PARENT.Square-Name}}-L1'},
      },
      'Layer-Area': {
        'component-namespace': 'faims-custom',
        'component-name': 'ComputedNumber',
        'type-returned': 'faims-core::Number',
        'component-parameters': {},
        expressionRefs: ['_PARENT.Square-Size'],
        expressionFn: (scope: Map<string, unknown>) =>
          (scope.get('_PARENT.Square-Size') as number) * 2,
      },
      'Square-Ref': {
        'component-namespace': 'faims-custom',
        'component-name': 'ParentFieldDisplay',
        'type-returned': 'faims-core::String',
        'component-parameters': {parentFieldId: 'Square-Name'},
      },
      'Layer-Notes': {
        'component-namespace': 'faims-custom',
        'component-name': 'TextField',
        'type-returned': 'faims-core::String',
        'component-parameters': {},
      },
    },
    views: {
      'Grid-Square-view': {
        fields: ['Square-Name', 'Square-Size', 'Layer-Children'],
        label: 'Grid Square',
      },
      'Layer-view': {
        fields: ['Layer-Name', 'Layer-Area', 'Square-Ref', 'Layer-Notes'],
        label: 'Layer',
      },
    },
    viewsets: {
      'Grid-Square': {views: ['Grid-Square-view'], label: 'Grid Square'},
      Layer: {views: ['Layer-view'], label: 'Layer'},
    },
    visible_types: ['Grid-Square', 'Layer'],
  };
  return spec;
};

// A spec with no parent-dependent forms at all.
const makePlainSpec = () => {
  const spec: any = {
    fields: {
      Notes: {
        'component-namespace': 'faims-custom',
        'component-name': 'TextField',
        'type-returned': 'faims-core::String',
        'component-parameters': {},
      },
    },
    views: {'A-view': {fields: ['Notes'], label: 'A'}},
    viewsets: {A: {views: ['A-view'], label: 'A'}},
    visible_types: ['A'],
  };
  return spec;
};

const entry = (data: unknown) => ({data, attachments: []});

describe('refreshDerivedValues', () => {
  let db: DatabaseInterface<DataDocument>;
  let engine: DataEngine;

  beforeEach(async () => {
    db = new PouchDB('test-refresh-db', {
      adapter: 'memory',
    }) as DatabaseInterface<DataDocument>;
    // Design documents for the record index used by paging.
    await couchInitialiser({
      db,
      content: initDataDB({projectId: 'test-refresh'}),
      config: {forceWrite: true, applyPermissions: false},
    });
    engine = new DataEngine({
      dataDb: db,
      uiSpec: makeSpec() as unknown as CompiledNotebookUiSpec,
    });
  });

  afterEach(async () => {
    await db.destroy();
  });

  /** Creates a Grid-Square with the given values and returns its record ID. */
  const createParent = async (name: string, size: number) => {
    const created = await engine.form.createRecord({
      formId: 'Grid-Square',
      createdBy: 'field-user',
    });
    await engine.form.updateRevision({
      recordId: created.record._id,
      revisionId: created.revision._id,
      update: {'Square-Name': entry(name), 'Square-Size': entry(size)},
      mode: 'new',
      updatedBy: 'field-user',
    });
    return created.record._id;
  };

  /** Creates a Layer under the given parent, saved with values as the form
   * would have derived them at save time. Returns the record ID. */
  const createChild = async (
    parentId: string,
    derived: {name: string; area: number; ref: string}
  ) => {
    const created = await engine.form.createRecord({
      formId: 'Layer',
      createdBy: 'field-user',
      relationship: {
        parent: [
          {
            recordId: parentId,
            fieldId: 'Layer-Children',
            relationTypeVocabPair: ['parent', 'child'],
          },
        ],
      },
    });
    await engine.form.updateRevision({
      recordId: created.record._id,
      revisionId: created.revision._id,
      update: {
        'Layer-Name': entry(derived.name),
        'Layer-Area': entry(derived.area),
        'Square-Ref': entry(derived.ref),
        'Layer-Notes': entry('dig notes'),
      },
      mode: 'new',
      updatedBy: 'field-user',
    });
    return created.record._id;
  };

  /** Updates the parent's values, simulating a later edit. Mode follows the
   * head revision's DAG parents, as any caller of updateRevision must. */
  const editParent = async (parentId: string, name: string, size: number) => {
    const existing = await engine.form.getExistingFormData({
      recordId: parentId,
    });
    const parents = existing.context.revision.parents ?? [];
    await engine.form.updateRevision({
      recordId: parentId,
      revisionId: existing.revisionId,
      update: {'Square-Name': entry(name), 'Square-Size': entry(size)},
      mode: parents.length === 0 ? 'new' : 'parent',
      updatedBy: 'field-user',
    });
  };

  test('refreshes stale template, computed and display values', async () => {
    const parentId = await createParent('A7', 10);
    const childId = await createChild(parentId, {
      name: 'A7-L1',
      area: 20,
      ref: 'A7',
    });

    await editParent(parentId, 'A8', 12);

    const summary = await refreshDerivedValues({engine, updatedBy: 'admin'});
    expect(summary.forms).toEqual(['Layer']);
    expect(summary.recordsUpdated).toBe(1);
    expect(summary.recordsFailed).toBe(0);

    const child = await engine.form.getExistingFormData({recordId: childId});
    expect(child.data['Layer-Name']?.data).toBe('A8-L1');
    expect(child.data['Layer-Area']?.data).toBe(24);
    expect(child.data['Square-Ref']?.data).toBe('A8');
    // Untouched local field rides through.
    expect(child.data['Layer-Notes']?.data).toBe('dig notes');
  });

  test('refreshes a parentless head in place, keeping the original creator', async () => {
    const parentId = await createParent('A7', 10);
    const childId = await createChild(parentId, {
      name: 'A7-L1',
      area: 20,
      ref: 'A7',
    });
    await editParent(parentId, 'A8', 12);

    await refreshDerivedValues({engine, updatedBy: 'admin'});

    // A head with no DAG parent is updated in place by the engine ('new'
    // mode): values refresh but no new creditable artefact exists.
    const child = await engine.form.getExistingFormData({recordId: childId});
    expect(child.data['Layer-Name']?.data).toBe('A8-L1');
    expect(child.context.revision.parents ?? []).toHaveLength(0);
    const avp = (await db.get(child.context.revision.avps['Layer-Name'])) as {
      created_by?: string;
    };
    expect(avp.created_by).toBe('field-user');
  });

  test('credits refreshed values to the given user on a parented head', async () => {
    const parentId = await createParent('A7', 10);
    const childId = await createChild(parentId, {
      name: 'A7-L1',
      area: 20,
      ref: 'A7',
    });

    // Fork the child's head, as device sync does, so the head has a DAG
    // parent and the refresh runs in 'parent' mode.
    const before = await engine.form.getExistingFormData({recordId: childId});
    await engine.form.createRevision({
      recordId: childId,
      revisionId: before.revisionId,
      createdBy: 'field-user',
    });

    await editParent(parentId, 'A8', 12);
    const summary = await refreshDerivedValues({engine, updatedBy: 'admin'});
    expect(summary.recordsUpdated).toBe(1);

    const child = await engine.form.getExistingFormData({recordId: childId});
    expect(child.data['Layer-Name']?.data).toBe('A8-L1');
    // Changed field: new AVP credited to the refresh user.
    const changedAvp = (await db.get(
      child.context.revision.avps['Layer-Name']
    )) as {created_by?: string};
    expect(changedAvp.created_by).toBe('admin');
    // Unchanged field: AVP reused, original credit intact.
    const reusedAvp = (await db.get(
      child.context.revision.avps['Layer-Notes']
    )) as {created_by?: string};
    expect(reusedAvp.created_by).toBe('field-user');
  });

  test('a second run writes nothing', async () => {
    const parentId = await createParent('A7', 10);
    await createChild(parentId, {name: 'A7-L1', area: 20, ref: 'A7'});
    await editParent(parentId, 'A8', 12);

    const first = await refreshDerivedValues({engine, updatedBy: 'admin'});
    expect(first.recordsUpdated).toBe(1);

    const second = await refreshDerivedValues({engine, updatedBy: 'admin'});
    expect(second.recordsExamined).toBe(first.recordsExamined);
    expect(second.recordsUpdated).toBe(0);
  });

  test('an unedited parent produces no revision', async () => {
    const parentId = await createParent('A7', 10);
    await createChild(parentId, {name: 'A7-L1', area: 20, ref: 'A7'});

    const summary = await refreshDerivedValues({engine, updatedBy: 'admin'});
    expect(summary.recordsExamined).toBe(1);
    expect(summary.recordsUpdated).toBe(0);
  });

  test('no-ops on a spec with no parent-dependent forms', async () => {
    const plainEngine = new DataEngine({
      dataDb: db,
      uiSpec: makePlainSpec() as unknown as CompiledNotebookUiSpec,
    });
    const summary = await refreshDerivedValues({
      engine: plainEngine,
      updatedBy: 'admin',
    });
    expect(summary).toEqual({
      forms: [],
      recordsExamined: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
    });
  });

  test('ignores deleted records', async () => {
    const parentId = await createParent('A7', 10);
    await createChild(parentId, {name: 'A7-L1', area: 20, ref: 'A7'});
    const deletedChildId = await createChild(parentId, {
      name: 'A7-L1',
      area: 20,
      ref: 'A7',
    });
    const existing = await engine.form.getExistingFormData({
      recordId: deletedChildId,
    });
    await engine.form.deleteRecord({
      recordId: deletedChildId,
      baseRevisionId: existing.revisionId,
      userId: 'field-user',
    });

    await editParent(parentId, 'A8', 12);
    const summary = await refreshDerivedValues({engine, updatedBy: 'admin'});
    expect(summary.recordsExamined).toBe(1);
    expect(summary.recordsUpdated).toBe(1);
    expect(summary.recordsFailed).toBe(0);
  });
});
