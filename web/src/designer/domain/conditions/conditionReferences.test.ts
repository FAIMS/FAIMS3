/**
 * @file Unit tests for condition traversal and option/field reference rewrites.
 */

import {describe, expect, it} from 'vitest';
import {
  findOptionReferences,
  isFieldUsedInCondition,
  replaceFieldInCondition,
  updateConditionReferences,
} from './conditionReferences';
import type {FieldType} from '../../state/initial';
import type {ConditionType} from '../../types/condition';

describe('conditionReferences — field usage and rename', () => {
  it('detects field usage in nested boolean conditions', () => {
    const condition: ConditionType = {
      operator: 'and',
      conditions: [
        {operator: 'equal', field: 'field-a', value: 'x'},
        {
          operator: 'or',
          conditions: [
            {operator: 'equal', field: 'field-b', value: 'y'},
            {operator: 'equal', field: 'field-c', value: 'z'},
          ],
        },
      ],
    };

    expect(isFieldUsedInCondition(condition, 'field-b')).toBe(true);
    expect(isFieldUsedInCondition(condition, 'field-missing')).toBe(false);
  });

  it('replaces field references recursively', () => {
    const condition: ConditionType = {
      operator: 'or',
      conditions: [
        {operator: 'equal', field: 'legacy-field', value: '1'},
        {
          operator: 'and',
          conditions: [
            {operator: 'greater', field: 'other', value: 2},
            {operator: 'equal', field: 'legacy-field', value: '3'},
          ],
        },
      ],
    };

    const updated = replaceFieldInCondition(
      condition,
      'legacy-field',
      'new-field'
    ) as ConditionType;

    expect(isFieldUsedInCondition(updated, 'legacy-field')).toBe(false);
    expect(isFieldUsedInCondition(updated, 'new-field')).toBe(true);
  });
});

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

describe('conditionReferences — option value references', () => {
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
