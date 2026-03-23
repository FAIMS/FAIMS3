import {describe, expect, it} from 'vitest';
import {
  isFieldUsedInCondition,
  replaceFieldInCondition,
} from './traversal';
import type {ConditionType} from '../../types/condition';

describe('condition traversal helpers', () => {
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
