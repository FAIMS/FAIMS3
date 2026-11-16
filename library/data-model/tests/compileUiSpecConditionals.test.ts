// SPDX-License-Identifier: Apache-2.0
import {
  compileUiSpecConditionals,
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  type CompiledChoiceOption,
  type CompiledFieldDefinition,
} from '../src';

const industrialOnly = {
  operator: 'equal',
  field: 'site-type',
  value: 'industrial',
};

const choiceOptions = (): CompiledChoiceOption[] => [
  {value: 'none', label: 'None observed'},
  {value: 'asbestos', label: 'Asbestos', condition: industrialOnly},
];

const specWithChoiceOptions = () =>
  ({
    viewsets: {Survey: {views: ['Survey-view'], label: 'Survey'}},
    views: {'Survey-view': {fields: ['hazards', 'site-type'], label: 'Survey'}},
    fields: {
      'site-type': {
        'component-namespace': 'faims-custom',
        'component-name': 'RadioGroup',
        'type-returned': 'faims-core::String',
        'component-parameters': {
          name: 'site-type',
          ElementProps: {
            options: [
              {value: 'industrial', label: 'Industrial'},
              {value: 'residential', label: 'Residential'},
            ],
          },
        },
      },
      hazards: {
        'component-namespace': 'faims-custom',
        'component-name': 'MultiSelect',
        'type-returned': 'faims-core::String',
        'component-parameters': {
          name: 'hazards',
          ElementProps: {options: choiceOptions()},
        },
      },
    },
    visible_types: ['Survey'],
  }) as any;

const optionsOn = (field: CompiledFieldDefinition): CompiledChoiceOption[] =>
  (
    field['component-parameters'] as {
      ElementProps: {options: CompiledChoiceOption[]};
    }
  ).ElementProps.options;

describe('compileUiSpecConditionals option conditions', () => {
  it('attaches conditionFn only on options that define a condition', () => {
    const spec = specWithChoiceOptions();
    compileUiSpecConditionals(spec);
    const options = optionsOn(spec.fields.hazards);
    expect(options[0].conditionFn).toBeUndefined();
    expect(typeof options[1].conditionFn).toBe('function');
    expect(options[1].conditionFn!({'site-type': 'industrial'})).toBe(true);
    expect(options[1].conditionFn!({'site-type': 'residential'})).toBe(false);
  });

  it('reuses the same compiled function across evaluations', () => {
    const spec = specWithChoiceOptions();
    compileUiSpecConditionals(spec);
    const option = optionsOn(spec.fields.hazards)[1];
    const fn = option.conditionFn;
    expect(fn).toBeDefined();
    expect(fn!({'site-type': 'industrial'})).toBe(true);
    expect(fn!({'site-type': 'residential'})).toBe(false);
    expect(option.conditionFn).toBe(fn);
  });

  it('does not persist conditionFn through JSON serialization', () => {
    const spec = specWithChoiceOptions();
    compileUiSpecConditionals(spec);
    const roundTripped = JSON.parse(
      JSON.stringify(optionsOn(spec.fields.hazards)[1])
    );
    expect(roundTripped.condition).toEqual(industrialOnly);
    expect(roundTripped).not.toHaveProperty('conditionFn');
  });

  it('leaves unconditioned option lists unchanged besides field-level compile', () => {
    const spec = specWithChoiceOptions();
    compileUiSpecConditionals(spec);
    const siteOptions = optionsOn(spec.fields['site-type']);
    expect(siteOptions.every(option => option.conditionFn === undefined)).toBe(
      true
    );
  });

  it('hides an option with an invalid condition without failing notebook compile', () => {
    const spec = specWithChoiceOptions();
    optionsOn(spec.fields.hazards).push({
      value: 'broken',
      label: 'Broken',
      condition: {operator: 'nopenope', field: 'site-type'},
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(() => compileUiSpecConditionals(spec)).not.toThrow();
      const options = optionsOn(spec.fields.hazards);
      expect(options[1].conditionFn!({'site-type': 'industrial'})).toBe(true);
      expect(options[2].conditionFn!({'site-type': 'industrial'})).toBe(false);
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('does not bump the notebook schema version', () => {
    expect(CURRENT_NOTEBOOK_UI_SCHEMA_VERSION).toBe('1.0.1');
  });
});
