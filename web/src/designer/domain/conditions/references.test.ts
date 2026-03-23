import {describe, expect, it} from 'vitest';
import {
  findOptionReferences,
  updateConditionReferences,
} from './references';
import type {FieldType} from '../../state/initial';
import type {ConditionType} from '../../types/condition';

const selectField: FieldType = {
  'component-namespace': 'faims-custom',
  'component-name': 'Select',
  'type-returned': 'faims-core::String',
  'component-parameters': {
    label: 'Choice',
    ElementProps: {
      options: [
        {label: 'A', value: 'A'},
        {label: 'B', value: 'B'},
      ],
    },
  },
};

const dependentField: FieldType = {
  'component-namespace': 'faims-custom',
  'component-name': 'FAIMSTextField',
  'type-returned': 'faims-core::String',
  'component-parameters': {label: 'Dependent'},
  condition: {operator: 'equal', field: 'choice', value: 'A'},
};

describe('condition reference helpers', () => {
  it('finds option references in field and section conditions', () => {
    const fields: Record<string, FieldType> = {
      choice: selectField,
      dependent: dependentField,
    };

    const sectionCondition: ConditionType = {
      operator: 'equal',
      field: 'choice',
      value: 'A',
    };

    const references = findOptionReferences(
      fields,
      {sectionA: {label: 'Section A', condition: sectionCondition}},
      'choice',
      'A'
    );

    expect(references).toContain('Field: Dependent');
    expect(references).toContain('Section: Section A');
  });

  it('updates matching condition values only', () => {
    const condition: ConditionType = {
      operator: 'and',
      conditions: [
        {operator: 'equal', field: 'choice', value: 'A'},
        {operator: 'equal', field: 'other', value: 'A'},
      ],
    };

    const updated = updateConditionReferences(condition, 'choice', 'A', 'AA');

    expect(updated.conditions?.[0].value).toBe('AA');
    expect(updated.conditions?.[1].value).toBe('A');
  });
});
