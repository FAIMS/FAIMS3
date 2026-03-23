import {describe, expect, it} from 'vitest';
import {getFieldSpec} from '../fields';
import type {NotebookUISpec} from './initial';
import {
  fieldAdded,
  fieldRenamed,
  uiSpecificationReducer,
  viewSetDeleted,
} from './uiSpec-reducer';

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
