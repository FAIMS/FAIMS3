// SPDX-License-Identifier: Apache-2.0
/**
 * @file Integration-style tests for UI-spec reducers (fields, sections, viewsets).
 */

import {describe, expect, it} from 'vitest';
import {getFieldSpec} from '../../../fields';
import type {NotebookUISpec} from '../../../state/initial';
import {CURRENT_NOTEBOOK_UI_SCHEMA_VERSION} from '../../../state/initial';
import {
  fieldAdded,
  fieldDeleted,
  fieldDuplicated,
  fieldMoved,
  fieldReordered,
  formVisibilityUpdated,
  fieldRenamed,
  sectionDeleted,
  sectionDuplicated,
  sectionMoved,
  uiSpecificationReducer,
  viewSetDeleted,
  viewSetHridUpdated,
  viewSetLayoutUpdated,
  viewSetDisplayInOverviewMapUpdated,
  viewSetSummaryFieldsUpdated,
} from '.';

const createBaseUiSpec = (): NotebookUISpec => ({
  fields: {},
  views: {
    sectionA: {
      label: 'Section A',
      fields: [],
    },
    sectionB: {
      label: 'Section B',
      fields: [],
    },
  },
  viewsets: {
    formA: {
      label: 'Form A',
      views: ['sectionA'],
      summary_fields: [],
    },
    formB: {
      label: 'Form B',
      views: ['sectionB'],
    },
  },
  visible_types: ['formA', 'formB'],
  settings: {showQrCodeButton: false},
  schemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
});

describe('uiSpecificationReducer', () => {
  it('adds fields with minted storage id, export name, and designer identifier', () => {
    const initial = createBaseUiSpec();

    const next = uiSpecificationReducer.reducer(
      initial,
      fieldAdded({
        fieldName: 'Text Field',
        fieldType: 'TextField',
        viewId: 'sectionA',
        viewSetId: 'formA',
        addAfter: '',
      })
    );

    const [storageId] = Object.keys(next.fields);
    expect(storageId).toMatch(/^f_[0-9a-f]{6}$/);
    expect(next.fields[storageId].designerIdentifier).toBeTypeOf('string');
    expect(next.fields[storageId].exportName).toBe('Text-Field');
    expect(next.fields[storageId]['component-parameters'].name).toBe(storageId);
    expect(next.views.sectionA.fields).toEqual([storageId]);
  });

  it('adds templated string fields with a minted storage id and slugged export name', () => {
    const initial = createBaseUiSpec();

    const next = uiSpecificationReducer.reducer(
      initial,
      fieldAdded({
        fieldName: 'New Field',
        fieldType: 'TemplatedStringField',
        viewId: 'sectionA',
        viewSetId: 'formA',
        addAfter: '',
      })
    );

    const [storageId] = Object.keys(next.fields);
    expect(storageId).toMatch(/^f_[0-9a-f]{6}$/);
    expect(next.views.sectionA.fields).toEqual([storageId]);
    expect(next.fields[storageId].exportName).toBe('New-Field');
    expect(next.fields[storageId]['component-parameters'].hidden).toBe(true);
  });

  it('renames exportName without moving the storage key or references', () => {
    const initial = createBaseUiSpec();
    const existingField = getFieldSpec('TextField');
    existingField['component-parameters'].name = 'old-field';
    existingField['component-parameters'].label = 'Old Field';
    existingField.exportName = 'old-field';

    initial.fields['old-field'] = existingField;
    initial.views.sectionA.fields = ['old-field'];
    initial.viewsets.formA.summary_fields = ['old-field'];
    initial.viewsets.formA.hridField = 'old-field';

    const next = uiSpecificationReducer.reducer(
      initial,
      fieldRenamed({
        viewId: 'sectionA',
        fieldName: 'old-field',
        newExportName: 'New Field',
      })
    );

    expect(next.fields['old-field']).toBeDefined();
    expect(next.fields['New-Field']).toBeUndefined();
    expect(next.fields['old-field'].exportName).toBe('New-Field');
    expect(next.fields['old-field']['component-parameters'].name).toBe(
      'old-field'
    );
    expect(next.views.sectionA.fields).toEqual(['old-field']);
    expect(next.viewsets.formA.summary_fields).toEqual(['old-field']);
    expect(next.viewsets.formA.hridField).toBe('old-field');
  });

  it('keeps the existing exportName when the typed name slugifies to empty', () => {
    const initial = createBaseUiSpec();
    const existingField = getFieldSpec('TextField');
    existingField['component-parameters'].name = 'old-field';
    existingField.exportName = 'Site-Name';
    initial.fields['old-field'] = existingField;
    initial.views.sectionA.fields = ['old-field'];

    const next = uiSpecificationReducer.reducer(
      initial,
      fieldRenamed({
        viewId: 'sectionA',
        fieldName: 'old-field',
        newExportName: '!!!',
      })
    );

    expect(next.fields['old-field'].exportName).toBe('Site-Name');
  });

  it('adds a non-empty fallback exportName when the field label slugifies to empty', () => {
    const initial = createBaseUiSpec();

    const next = uiSpecificationReducer.reducer(
      initial,
      fieldAdded({
        fieldName: '!!!',
        fieldType: 'TextField',
        viewId: 'sectionA',
        viewSetId: 'formA',
        addAfter: '',
      })
    );

    const [storageId] = Object.keys(next.fields);
    expect(next.fields[storageId].exportName).toBe('field');
  });

  it('moves then deletes fields and removes summary references', () => {
    const initial = createBaseUiSpec();
    const fieldA = getFieldSpec('TextField');
    const fieldB = getFieldSpec('TextField');

    fieldA['component-parameters'].name = 'field-a';
    fieldB['component-parameters'].name = 'field-b';

    initial.fields['field-a'] = fieldA;
    initial.fields['field-b'] = fieldB;
    initial.views.sectionA.fields = ['field-a', 'field-b'];
    initial.viewsets.formA.summary_fields = ['field-b'];

    const moved = uiSpecificationReducer.reducer(
      initial,
      fieldMoved({
        fieldName: 'field-a',
        viewId: 'sectionA',
        direction: 'down',
      })
    );
    expect(moved.views.sectionA.fields).toEqual(['field-b', 'field-a']);

    const deleted = uiSpecificationReducer.reducer(
      moved,
      fieldDeleted({fieldName: 'field-b', viewId: 'sectionA'})
    );
    expect(deleted.fields['field-b']).toBeUndefined();
    expect(deleted.views.sectionA.fields).toEqual(['field-a']);
    expect(deleted.viewsets.formA.summary_fields).toEqual([]);
  });

  it('reorders fields by absolute index within a section', () => {
    const initial = createBaseUiSpec();
    const fieldA = getFieldSpec('TextField');
    const fieldB = getFieldSpec('TextField');
    const fieldC = getFieldSpec('TextField');

    fieldA['component-parameters'].name = 'field-a';
    fieldB['component-parameters'].name = 'field-b';
    fieldC['component-parameters'].name = 'field-c';

    initial.fields['field-a'] = fieldA;
    initial.fields['field-b'] = fieldB;
    initial.fields['field-c'] = fieldC;
    initial.views.sectionA.fields = ['field-a', 'field-b', 'field-c'];

    const next = uiSpecificationReducer.reducer(
      initial,
      fieldReordered({viewId: 'sectionA', sourceIndex: 2, targetIndex: 0})
    );

    expect(next.views.sectionA.fields).toEqual([
      'field-c',
      'field-a',
      'field-b',
    ]);
  });

  it('duplicates, moves, and deletes sections with field lifecycle updates', () => {
    const initial = createBaseUiSpec();
    const sourceField = getFieldSpec('TextField');
    sourceField['component-parameters'].name = 'field-a';
    sourceField['component-parameters'].label = 'Field A';
    sourceField.exportName = 'field-a';
    initial.fields['field-a'] = sourceField;
    initial.views.sectionA.fields = ['field-a'];

    const duplicated = uiSpecificationReducer.reducer(
      initial,
      sectionDuplicated({
        sourceViewId: 'sectionA',
        destinationViewSetId: 'formB',
        newSectionLabel: 'Section Clone',
      })
    );

    const duplicatedSectionId = 'formB-Section-Clone';
    const duplicatedSection = duplicated.views[duplicatedSectionId];
    expect(duplicatedSection).toBeDefined();
    expect(duplicated.viewsets.formB.views).toContain(duplicatedSectionId);
    expect(duplicatedSection.fields).toHaveLength(1);

    const duplicatedFieldName = duplicatedSection.fields[0];
    expect(duplicatedFieldName).not.toBe('field-a');
    expect(duplicatedFieldName).toMatch(/^f_[0-9a-f]{6}$/);
    expect(duplicated.fields[duplicatedFieldName]).toBeDefined();
    expect(
      duplicated.fields[duplicatedFieldName].designerIdentifier
    ).toBeTypeOf('string');
    expect(duplicated.fields[duplicatedFieldName].exportName).toBe('field-a-1');
    expect(duplicated.fields['field-a'].exportName).toBe('field-a');

    const moved = uiSpecificationReducer.reducer(
      duplicated,
      sectionMoved({
        viewSetId: 'formB',
        viewId: duplicatedSectionId,
        direction: 'left',
      })
    );
    expect(moved.viewsets.formB.views[0]).toBe(duplicatedSectionId);

    const deleted = uiSpecificationReducer.reducer(
      moved,
      sectionDeleted({viewSetID: 'formB', viewID: duplicatedSectionId})
    );
    expect(deleted.views[duplicatedSectionId]).toBeUndefined();
    expect(deleted.fields[duplicatedFieldName]).toBeUndefined();
    expect(deleted.viewsets.formB.views).toEqual(['sectionB']);
  });

  it('uniquifies exportName when duplicating a section in the same form', () => {
    const initial = createBaseUiSpec();
    const sourceField = getFieldSpec('TextField');
    sourceField['component-parameters'].name = 'field-a';
    sourceField['component-parameters'].label = 'Site Name';
    sourceField.exportName = 'Site-Name';
    initial.fields['field-a'] = sourceField;
    initial.views.sectionA.fields = ['field-a'];

    const duplicated = uiSpecificationReducer.reducer(
      initial,
      sectionDuplicated({
        sourceViewId: 'sectionA',
        newSectionLabel: 'Section A Copy',
      })
    );

    const clonedSection = duplicated.views['formA-Section-A-Copy'];
    expect(clonedSection).toBeDefined();
    const clonedFieldName = clonedSection.fields[0];
    expect(clonedFieldName).toMatch(/^f_[0-9a-f]{6}$/);
    expect(duplicated.fields[clonedFieldName].exportName).toBe('Site-Name-1');
    expect(duplicated.fields['field-a'].exportName).toBe('Site-Name');
    expect(duplicated.viewsets.formA.views).toEqual([
      'sectionA',
      'formA-Section-A-Copy',
    ]);
  });

  it('duplicates a field with a minted storage id and a unique export name', () => {
    const initial = createBaseUiSpec();
    const sourceField = getFieldSpec('TextField');
    sourceField['component-parameters'].name = 'field-a';
    sourceField['component-parameters'].label = 'Site Name';
    sourceField.exportName = 'Site-Name';
    initial.fields['field-a'] = sourceField;
    initial.views.sectionA.fields = ['field-a'];

    const next = uiSpecificationReducer.reducer(
      initial,
      fieldDuplicated({
        originalFieldName: 'field-a',
        newFieldName: 'Site Name',
        viewId: 'sectionA',
      })
    );

    expect(next.fields['field-a']).toBeDefined();
    expect(next.fields['field-a'].exportName).toBe('Site-Name');
    expect(next.fields['field-a']['component-parameters'].name).toBe('field-a');

    const copyId = next.views.sectionA.fields.find(id => id !== 'field-a');
    expect(copyId).toBeDefined();
    expect(copyId).toMatch(/^f_[0-9a-f]{6}$/);
    expect(next.fields[copyId!]).toBeDefined();
    expect(next.fields[copyId!].exportName).toBe('Site-Name-1');
    expect(next.fields[copyId!]['component-parameters'].name).toBe(copyId);
    expect(next.fields[copyId!]['component-parameters'].label).toBe(
      'Site Name'
    );
    expect(next.views.sectionA.fields).toEqual(['field-a', copyId]);
  });

  it('uses a caller-supplied storage id when adding a field', () => {
    const initial = createBaseUiSpec();
    const storageId = 'f_0123456789ab';

    const next = uiSpecificationReducer.reducer(
      initial,
      fieldAdded({
        fieldName: 'New Field',
        fieldType: 'TextField',
        viewId: 'sectionA',
        viewSetId: 'formA',
        addAfter: '',
        storageId,
      })
    );

    expect(next.fields[storageId]).toBeDefined();
    expect(next.views.sectionA.fields).toEqual([storageId]);
    expect(next.fields[storageId].exportName).toBe('New-Field');
  });

  it('updates viewset visibility and display settings', () => {
    const initial = createBaseUiSpec();

    const summaryUpdated = uiSpecificationReducer.reducer(
      initial,
      viewSetSummaryFieldsUpdated({viewSetId: 'formA', fields: ['field-a']})
    );
    expect(summaryUpdated.viewsets.formA.summary_fields).toEqual(['field-a']);

    const hridUpdated = uiSpecificationReducer.reducer(
      summaryUpdated,
      viewSetHridUpdated({viewSetId: 'formA', hridField: 'field-a'})
    );
    expect(hridUpdated.viewsets.formA.hridField).toBe('field-a');

    const layoutUpdated = uiSpecificationReducer.reducer(
      hridUpdated,
      viewSetLayoutUpdated({viewSetId: 'formA', layout: 'tabs'})
    );
    expect(layoutUpdated.viewsets.formA.layout).toBe('tabs');

    const mapHidden = uiSpecificationReducer.reducer(
      layoutUpdated,
      viewSetDisplayInOverviewMapUpdated({
        viewSetId: 'formA',
        displayInOverviewMap: false,
      })
    );
    expect(mapHidden.viewsets.formA.displayInOverviewMap).toBe(false);

    expect(layoutUpdated.visible_types).toEqual(['formA', 'formB']);

    const shown = uiSpecificationReducer.reducer(
      layoutUpdated,
      formVisibilityUpdated({
        viewSetId: 'formA',
        ticked: true,
        initialIndex: 0,
      })
    );
    expect(shown.visible_types).toEqual(['formA', 'formB']);

    const hidden = uiSpecificationReducer.reducer(
      layoutUpdated,
      formVisibilityUpdated({
        viewSetId: 'formB',
        ticked: false,
        initialIndex: 0,
      })
    );
    expect(hidden.visible_types).toEqual(['formA']);
  });

  it('deletes viewset with its sections and fields', () => {
    const initial = createBaseUiSpec();
    const fieldA = getFieldSpec('TextField');
    fieldA['component-parameters'].name = 'field-a';
    initial.fields['field-a'] = fieldA;
    initial.views.sectionA.fields = ['field-a'];

    const next = uiSpecificationReducer.reducer(
      initial,
      viewSetDeleted({viewSetId: 'formA'})
    );

    expect(next.viewsets.formA).toBeUndefined();
    expect(next.views.sectionA).toBeUndefined();
    expect(next.fields['field-a']).toBeUndefined();
    expect(next.visible_types.includes('formA')).toBe(false);
  });
});
