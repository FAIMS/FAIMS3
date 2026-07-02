import {describe, expect, test} from 'vitest';
import type {FieldType} from '../../state/initial';
import {
  applyFieldFilters,
  buildFieldSearchEntry,
  resolveFieldIdsInScope,
  weightedFieldSearch,
} from './index';

const textField = (
  label: string,
  id: string,
  extra?: Partial<FieldType>
): FieldType =>
  ({
    'component-namespace': 'faims-custom',
    'component-name': 'TextField',
    'type-returned': 'faims-core::String',
    'component-parameters': {
      name: id,
      label,
      helperText: '',
      advancedHelperText: '',
      required: false,
    },
    initialValue: '',
    ...extra,
  }) as FieldType;

const views = {
  'section-a': {label: 'Section A', fields: ['field-a', 'field-b']},
  'section-b': {label: 'Section B', fields: ['field-c']},
  'other-section': {label: 'Other', fields: ['other-field']},
};

const viewsets = {
  primary: {label: 'Primary', views: ['section-a', 'section-b']},
  secondary: {label: 'Secondary', views: ['other-section']},
};

const allFields: Record<string, FieldType> = {
  'field-a': textField('Alpha Widget', 'field-a', {
    'component-parameters': {
      name: 'field-a',
      label: 'Alpha Widget',
      helperText: 'First helper',
      advancedHelperText: '',
      required: true,
    },
  }),
  'field-b': textField('Beta Control', 'field-b'),
  'field-c': textField('Gamma Input', 'field-c'),
  'other-field': textField('Cross Form', 'other-field'),
};

describe('resolveFieldIdsInScope', () => {
  test('returns all fields for all scope', () => {
    expect(
      resolveFieldIdsInScope(allFields, views, viewsets, {kind: 'all'})
    ).toEqual(Object.keys(allFields));
  });

  test('returns viewset fields only', () => {
    expect(
      resolveFieldIdsInScope(allFields, views, viewsets, {
        kind: 'viewset',
        viewsetId: 'primary',
      })
    ).toEqual(['field-a', 'field-b', 'field-c']);
  });

  test('context field scope excludes self and other forms', () => {
    expect(
      resolveFieldIdsInScope(allFields, views, viewsets, {
        kind: 'context',
        fieldId: 'field-a',
      })
    ).toEqual(['field-b', 'field-c']);
  });

  test('context section scope excludes section fields', () => {
    expect(
      resolveFieldIdsInScope(allFields, views, viewsets, {
        kind: 'context',
        sectionId: 'section-a',
      })
    ).toEqual(['field-c']);
  });
});

describe('applyFieldFilters', () => {
  test('filters by required and component name', () => {
    const numericField = textField('Num', 'num-field', {
      'component-name': 'NumberField',
      'type-returned': 'faims-core::Number',
    });
    const fields = {...allFields, 'num-field': numericField};

    expect(
      applyFieldFilters(['field-a', 'num-field'], fields, {required: true})
    ).toEqual(['field-a']);

    expect(
      applyFieldFilters(['field-a', 'num-field'], fields, {
        componentNames: ['NumberField'],
      })
    ).toEqual(['num-field']);
  });
});

describe('weightedFieldSearch', () => {
  test('returns alphabetically sorted results for empty query', () => {
    const entries = ['field-c', 'field-a', 'field-b'].map(id =>
      buildFieldSearchEntry(id, allFields[id])
    );
    const results = weightedFieldSearch(entries, '');
    expect(results.map(r => r.fieldId)).toEqual([
      'field-a',
      'field-b',
      'field-c',
    ]);
  });

  test('ranks label matches above helper text matches', () => {
    const entries = [
      buildFieldSearchEntry('field-a', allFields['field-a']),
      buildFieldSearchEntry('field-b', allFields['field-b']),
    ];

    const results = weightedFieldSearch(entries, 'alpha');
    expect(results[0]?.fieldId).toBe('field-a');
  });

  test('finds fields by helper text with lower priority', () => {
    const entries = [buildFieldSearchEntry('field-a', allFields['field-a'])];
    const results = weightedFieldSearch(entries, 'first helper');
    expect(results).toHaveLength(1);
    expect(results[0]?.fieldId).toBe('field-a');
  });

  test('finds fields by id', () => {
    const entries = [buildFieldSearchEntry('field-b', allFields['field-b'])];
    const results = weightedFieldSearch(entries, 'field-b');
    expect(results[0]?.fieldId).toBe('field-b');
  });
});
