/**
 * @file Integration-style tests for UI-spec reducers (fields, sections, viewsets).
 */

import {describe, expect, it} from 'vitest';
import {getFieldSpec} from '../../../fields';
import type {NotebookUISpec} from '../../../state/initial';
import {
  fieldAdded,
  fieldDeleted,
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
  viewSetPublishButtonBehaviourUpdated,
  viewSetSummaryFieldsUpdated,
} from '.';

const createBaseUiSpec = (): NotebookUISpec => ({
  fields: {},
  fviews: {
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
      publishButtonBehaviour: 'always',
      summary_fields: [],
    },
    formB: {
      label: 'Form B',
      views: ['sectionB'],
      publishButtonBehaviour: 'always',
    },
  },
  visible_types: ['formA', 'formB'],
});

describe('uiSpecificationReducer', () => {
  it('adds fields with slugged key and designer identifier', () => {
    const initial = createBaseUiSpec();

    const next = uiSpecificationReducer.reducer(
      initial,
      fieldAdded({
        fieldName: 'Text Field',
        fieldType: 'FAIMSTextField',
        viewId: 'sectionA',
        viewSetId: 'formA',
        addAfter: '',
      })
    );

    expect(Object.keys(next.fields)).toEqual(['Text-Field']);
    expect(next.fields['Text-Field'].designerIdentifier).toBeTypeOf('string');
    expect(next.fviews.sectionA.fields).toEqual(['Text-Field']);
  });

  it('renames field and updates summary/hrid references', () => {
    const initial = createBaseUiSpec();
    const existingField = getFieldSpec('FAIMSTextField');
    existingField['component-parameters'].name = 'old-field';
    existingField['component-parameters'].label = 'Old Field';

    initial.fields['old-field'] = existingField;
    initial.fviews.sectionA.fields = ['old-field'];
    initial.viewsets.formA.summary_fields = ['old-field'];
    initial.viewsets.formA.hridField = 'old-field';

    const next = uiSpecificationReducer.reducer(
      initial,
      fieldRenamed({
        viewId: 'sectionA',
        fieldName: 'old-field',
        newFieldName: 'New Field',
      })
    );

    expect(next.fields['New-Field']).toBeDefined();
    expect(next.fields['old-field']).toBeUndefined();
    expect(next.fviews.sectionA.fields).toEqual(['New-Field']);
    expect(next.viewsets.formA.summary_fields).toEqual(['New-Field']);
    expect(next.viewsets.formA.hridField).toBe('New-Field');
  });

  it('moves then deletes fields and removes summary references', () => {
    const initial = createBaseUiSpec();
    const fieldA = getFieldSpec('FAIMSTextField');
    const fieldB = getFieldSpec('FAIMSTextField');

    fieldA['component-parameters'].name = 'field-a';
    fieldB['component-parameters'].name = 'field-b';

    initial.fields['field-a'] = fieldA;
    initial.fields['field-b'] = fieldB;
    initial.fviews.sectionA.fields = ['field-a', 'field-b'];
    initial.viewsets.formA.summary_fields = ['field-b'];

    const moved = uiSpecificationReducer.reducer(
      initial,
      fieldMoved({
        fieldName: 'field-a',
        viewId: 'sectionA',
        direction: 'down',
      })
    );
    expect(moved.fviews.sectionA.fields).toEqual(['field-b', 'field-a']);

    const deleted = uiSpecificationReducer.reducer(
      moved,
      fieldDeleted({fieldName: 'field-b', viewId: 'sectionA'})
    );
    expect(deleted.fields['field-b']).toBeUndefined();
    expect(deleted.fviews.sectionA.fields).toEqual(['field-a']);
    expect(deleted.viewsets.formA.summary_fields).toEqual([]);
  });

  it('reorders fields by absolute index within a section', () => {
    const initial = createBaseUiSpec();
    const fieldA = getFieldSpec('FAIMSTextField');
    const fieldB = getFieldSpec('FAIMSTextField');
    const fieldC = getFieldSpec('FAIMSTextField');

    fieldA['component-parameters'].name = 'field-a';
    fieldB['component-parameters'].name = 'field-b';
    fieldC['component-parameters'].name = 'field-c';

    initial.fields['field-a'] = fieldA;
    initial.fields['field-b'] = fieldB;
    initial.fields['field-c'] = fieldC;
    initial.fviews.sectionA.fields = ['field-a', 'field-b', 'field-c'];

    const next = uiSpecificationReducer.reducer(
      initial,
      fieldReordered({viewId: 'sectionA', sourceIndex: 2, targetIndex: 0})
    );

    expect(next.fviews.sectionA.fields).toEqual([
      'field-c',
      'field-a',
      'field-b',
    ]);
  });

  it('duplicates, moves, and deletes sections with field lifecycle updates', () => {
    const initial = createBaseUiSpec();
    const sourceField = getFieldSpec('FAIMSTextField');
    sourceField['component-parameters'].name = 'field-a';
    sourceField['component-parameters'].label = 'Field A';
    initial.fields['field-a'] = sourceField;
    initial.fviews.sectionA.fields = ['field-a'];

    const duplicated = uiSpecificationReducer.reducer(
      initial,
      sectionDuplicated({
        sourceViewId: 'sectionA',
        destinationViewSetId: 'formB',
        newSectionLabel: 'Section Clone',
      })
    );

    const duplicatedSectionId = 'formB-Section-Clone';
    const duplicatedSection = duplicated.fviews[duplicatedSectionId];
    expect(duplicatedSection).toBeDefined();
    expect(duplicated.viewsets.formB.views).toContain(duplicatedSectionId);
    expect(duplicatedSection.fields).toHaveLength(1);

    const duplicatedFieldName = duplicatedSection.fields[0];
    expect(duplicatedFieldName).not.toBe('field-a');
    expect(duplicated.fields[duplicatedFieldName]).toBeDefined();
    expect(
      duplicated.fields[duplicatedFieldName].designerIdentifier
    ).toBeTypeOf('string');

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
    expect(deleted.fviews[duplicatedSectionId]).toBeUndefined();
    expect(deleted.fields[duplicatedFieldName]).toBeUndefined();
    expect(deleted.viewsets.formB.views).toEqual(['sectionB']);
  });

  it('updates viewset visibility and presentation settings', () => {
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

    const publishUpdated = uiSpecificationReducer.reducer(
      layoutUpdated,
      viewSetPublishButtonBehaviourUpdated({
        viewSetId: 'formA',
        publishButtonBehaviour: 'noErrors',
      })
    );
    expect(publishUpdated.viewsets.formA.publishButtonBehaviour).toBe(
      'noErrors'
    );

    const hidden = uiSpecificationReducer.reducer(
      publishUpdated,
      formVisibilityUpdated({
        viewSetId: 'formA',
        ticked: false,
        initialIndex: 0,
      })
    );
    expect(hidden.visible_types).toEqual(['formB']);

    const shown = uiSpecificationReducer.reducer(
      hidden,
      formVisibilityUpdated({
        viewSetId: 'formA',
        ticked: true,
        initialIndex: 0,
      })
    );
    expect(shown.visible_types).toEqual(['formB', 'formA']);
  });

  it('deletes viewset with its sections and fields', () => {
    const initial = createBaseUiSpec();
    const fieldA = getFieldSpec('FAIMSTextField');
    fieldA['component-parameters'].name = 'field-a';
    initial.fields['field-a'] = fieldA;
    initial.fviews.sectionA.fields = ['field-a'];

    const next = uiSpecificationReducer.reducer(
      initial,
      viewSetDeleted({viewSetId: 'formA'})
    );

    expect(next.viewsets.formA).toBeUndefined();
    expect(next.fviews.sectionA).toBeUndefined();
    expect(next.fields['field-a']).toBeUndefined();
    expect(next.visible_types.includes('formA')).toBe(false);
  });
});
