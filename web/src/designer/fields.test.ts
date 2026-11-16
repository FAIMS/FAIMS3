// SPDX-License-Identifier: Apache-2.0
/**
 * Default field templates cloned by the chooser and `fieldAdded`.
 */

import type {ChoiceElementProps} from '@faims3/forms';
import {describe, expect, it} from 'vitest';
import {getFieldSpec} from './fields';
import type {FieldType} from './state/initial';
import {sampleNotebook} from './test-notebook';

function choiceElementProps(field: FieldType): ChoiceElementProps {
  return field['component-parameters'].ElementProps as ChoiceElementProps;
}

describe('getFieldSpec choice templates', () => {
  it('starts RadioGroup and MultiSelect with empty options that are not shared', () => {
    const radio = getFieldSpec('RadioGroup');
    const radioAgain = getFieldSpec('RadioGroup');
    const multi = getFieldSpec('MultiSelect');
    const multiAgain = getFieldSpec('MultiSelect');

    expect(choiceElementProps(radio).options).toEqual([]);
    expect(choiceElementProps(multi).options).toEqual([]);
    expect(choiceElementProps(radio).enableOtherOption).toBe(false);
    expect(choiceElementProps(multi).enableOtherOption).toBe(false);
    expect(choiceElementProps(multi).expandedChecklist).toBe(true);

    expect(choiceElementProps(radio).options).not.toBe(
      choiceElementProps(radioAgain).options
    );
    expect(choiceElementProps(multi).options).not.toBe(
      choiceElementProps(multiAgain).options
    );

    choiceElementProps(radio).options.push({value: 'x', label: 'x'});
    expect(choiceElementProps(radioAgain).options).toEqual([]);
    expect(choiceElementProps(getFieldSpec('RadioGroup')).options).toEqual([]);
    expect(choiceElementProps(multi).options).toEqual([]);
  });

  it('leaves the hidden Select template empty and AdvancedSelect Default node in place', () => {
    expect(choiceElementProps(getFieldSpec('Select')).options).toEqual([]);

    const advanced = getFieldSpec('AdvancedSelect')['component-parameters']
      .ElementProps as {optiontree: Array<{name: string; children: unknown[]}>};
    expect(advanced.optiontree).toEqual([{name: 'Default', children: []}]);
  });

  it('does not strip options already stored on notebook RadioGroup fixtures', () => {
    const typeOptions = (
      sampleNotebook.uiSpec.fields.Type['component-parameters'] as unknown as {
        ElementProps: ChoiceElementProps;
      }
    ).ElementProps.options;
    const hazardOptions = (
      sampleNotebook.uiSpec.fields.safety_hazard[
        'component-parameters'
      ] as unknown as {
        ElementProps: ChoiceElementProps;
      }
    ).ElementProps.options;

    expect(typeOptions.map(option => option.value)).toEqual([
      'Igneous',
      'Metamorphic',
      'Sedementary',
    ]);
    expect(hazardOptions.map(option => option.value)).toEqual([
      'true',
      'false',
    ]);
  });
});
