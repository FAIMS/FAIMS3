// SPDX-License-Identifier: Apache-2.0

import {CURRENT_NOTEBOOK_UI_SCHEMA_VERSION} from '@faims3/data-model';
import {describe, expect, it} from 'vitest';
import {ChoiceOptionSchema} from './choiceFieldParams';
import {
  otherOptionPositionAmongVisible,
  visibleChoiceOptions,
} from './visibleChoiceOptions';

const industrialOnly = {
  operator: 'equal',
  field: 'site-type',
  value: 'industrial',
};

const options = [
  {value: 'none', label: 'None observed'},
  {value: 'asbestos', label: 'Asbestos', condition: industrialOnly},
];

describe('ChoiceOptionSchema', () => {
  it('accepts an option without a condition', () => {
    expect(
      ChoiceOptionSchema.safeParse({value: 'none', label: 'None observed'})
        .success
    ).toBe(true);
  });

  it('accepts an option with a condition AST', () => {
    const parsed = ChoiceOptionSchema.safeParse({
      value: 'asbestos',
      label: 'Asbestos',
      condition: industrialOnly,
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.condition).toEqual(industrialOnly);
  });

  it('does not persist a compiled conditionFn on the option object', () => {
    const parsed = ChoiceOptionSchema.parse({
      value: 'asbestos',
      label: 'Asbestos',
      condition: industrialOnly,
    });
    expect(parsed).not.toHaveProperty('conditionFn');
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(parsed);
  });
});

describe('visibleChoiceOptions', () => {
  it('offers an option with no condition', () => {
    expect(
      visibleChoiceOptions(options, {'site-type': 'residential'}).map(
        option => option.value
      )
    ).toEqual(['none']);
  });

  it('offers a conditioned option when the expression is true', () => {
    expect(
      visibleChoiceOptions(options, {'site-type': 'industrial'}).map(
        option => option.value
      )
    ).toEqual(['none', 'asbestos']);
  });

  it('hides a conditioned option when the expression is false', () => {
    expect(
      visibleChoiceOptions(options, {'site-type': 'residential'}).map(
        option => option.value
      )
    ).toEqual(['none']);
  });

  it('keeps a selected option visible even when its condition is false', () => {
    expect(
      visibleChoiceOptions(
        options,
        {'site-type': 'residential'},
        'asbestos'
      ).map(option => option.value)
    ).toEqual(['none', 'asbestos']);
  });

  it('keeps a selected MultiSelect member visible when its condition is false', () => {
    expect(
      visibleChoiceOptions(options, {'site-type': 'residential'}, [
        'asbestos',
      ]).map(option => option.value)
    ).toEqual(['none', 'asbestos']);
  });
});

describe('otherOptionPositionAmongVisible', () => {
  it('maps Other onto the filtered list after the same visible predecessors', () => {
    const all = [
      {value: 'a', label: 'A'},
      {value: 'b', label: 'B', condition: industrialOnly},
      {value: 'c', label: 'C'},
    ];
    const visible = visibleChoiceOptions(all, {'site-type': 'residential'});
    // Other was after A and B (index 2). B is hidden, so Other follows A.
    expect(otherOptionPositionAmongVisible(all, visible, 2)).toBe(1);
  });
});

describe('notebook schema version', () => {
  it('does not bump CURRENT_NOTEBOOK_UI_SCHEMA_VERSION for option conditions', () => {
    expect(CURRENT_NOTEBOOK_UI_SCHEMA_VERSION).toBe('1.0.1');
  });
});
