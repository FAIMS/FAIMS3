import {
  buildConditionValues,
  compileExpression,
  encodeParentRef,
  encodeRelatedRef,
} from '../src';

describe('buildConditionValues', () => {
  it('returns form values unchanged when there is no context', () => {
    const values = {'Field-A': 1, 'Field-B': 'x'};
    expect(buildConditionValues({values})).toEqual(values);
  });

  it('returns form values unchanged when context has no parent or related values', () => {
    const values = {'Field-A': 1};
    const context = {createdBy: 'someone', createdTime: 123};
    expect(buildConditionValues({values, context})).toEqual(values);
  });

  it('merges parent values under _PARENT keys', () => {
    const result = buildConditionValues({
      values: {'Field-A': 1},
      context: {parentValues: {'Site-Name': 'North', 'Grid-Square': 'A7'}},
    });
    expect(result).toEqual({
      'Field-A': 1,
      [encodeParentRef('Site-Name')]: 'North',
      [encodeParentRef('Grid-Square')]: 'A7',
    });
  });

  it('merges related values under dotted keys per link field', () => {
    const result = buildConditionValues({
      values: {'Field-A': 1},
      context: {
        relatedValues: {
          'Core-Calibration': {'Cutter-Mass-g': 102.5},
          'Other-Link': {Status: 'done'},
        },
      },
    });
    expect(result).toEqual({
      'Field-A': 1,
      [encodeRelatedRef('Core-Calibration', 'Cutter-Mass-g')]: 102.5,
      [encodeRelatedRef('Other-Link', 'Status')]: 'done',
    });
  });

  it('merges parent and related values together', () => {
    const result = buildConditionValues({
      values: {'Field-A': 1},
      context: {
        parentValues: {'Site-Name': 'North'},
        relatedValues: {'Core-Calibration': {'Cutter-Mass-g': 102.5}},
      },
    });
    expect(result[encodeParentRef('Site-Name')]).toBe('North');
    expect(result[encodeRelatedRef('Core-Calibration', 'Cutter-Mass-g')]).toBe(
      102.5
    );
    expect(result['Field-A']).toBe(1);
  });

  it('handles empty parent and related objects', () => {
    const result = buildConditionValues({
      values: {'Field-A': 1},
      context: {parentValues: {}, relatedValues: {'Link-Field': {}}},
    });
    expect(result).toEqual({'Field-A': 1});
  });

  it('does not mutate the input values object', () => {
    const values = {'Field-A': 1};
    buildConditionValues({
      values,
      context: {parentValues: {'Site-Name': 'North'}},
    });
    expect(values).toEqual({'Field-A': 1});
  });

  it('copies values raw, without coercion', () => {
    const result = buildConditionValues({
      values: {},
      context: {parentValues: {Tags: ['a', 'b'], Count: '3'}},
    });
    expect(result[encodeParentRef('Tags')]).toEqual(['a', 'b']);
    // string stays a string, unlike expression coercion
    expect(result[encodeParentRef('Count')]).toBe('3');
  });
});

describe('conditions evaluated over merged values', () => {
  const parentRef = encodeParentRef('Grid-Square');
  const relatedRef = encodeRelatedRef('Core-Calibration', 'Status');

  const merged = (
    context?: Parameters<typeof buildConditionValues>[0]['context']
  ) => buildConditionValues({values: {'Local-Field': 'yes'}, context});

  it('equal matches a parent value', () => {
    const fn = compileExpression({
      operator: 'equal',
      field: parentRef,
      value: 'A7',
    });
    expect(fn(merged({parentValues: {'Grid-Square': 'A7'}}))).toBe(true);
    expect(fn(merged({parentValues: {'Grid-Square': 'B2'}}))).toBe(false);
  });

  it('equal is false when there is no parent', () => {
    const fn = compileExpression({
      operator: 'equal',
      field: parentRef,
      value: 'A7',
    });
    expect(fn(merged())).toBe(false);
  });

  it('not-equal is true when there is no parent, matching missing-field semantics', () => {
    const fn = compileExpression({
      operator: 'not-equal',
      field: parentRef,
      value: 'A7',
    });
    expect(fn(merged())).toBe(true);
  });

  it('string-contains works on a related value', () => {
    const fn = compileExpression({
      operator: 'string-contains',
      field: relatedRef,
      value: 'cali',
    });
    expect(
      fn(merged({relatedValues: {'Core-Calibration': {Status: 'calibrated'}}}))
    ).toBe(true);
    expect(fn(merged())).toBe(false);
  });

  it('contains works on a parent array value', () => {
    const ref = encodeParentRef('Tags');
    const fn = compileExpression({
      operator: 'contains',
      field: ref,
      value: 'wet',
    });
    expect(fn(merged({parentValues: {Tags: ['wet', 'clay']}}))).toBe(true);
    expect(fn(merged({parentValues: {Tags: ['dry']}}))).toBe(false);
    expect(fn(merged())).toBe(false);
  });

  it('and combines local and parent references', () => {
    const fn = compileExpression({
      operator: 'and',
      conditions: [
        {operator: 'equal', field: 'Local-Field', value: 'yes'},
        {operator: 'equal', field: parentRef, value: 'A7'},
      ],
    });
    expect(fn(merged({parentValues: {'Grid-Square': 'A7'}}))).toBe(true);
    expect(fn(merged({parentValues: {'Grid-Square': 'B2'}}))).toBe(false);
  });
});
