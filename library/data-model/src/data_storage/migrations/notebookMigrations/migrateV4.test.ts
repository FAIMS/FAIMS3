import {migrateNotebook} from './index';
import {migrateToV4} from './migrateV4';

/** Minimal v3-shaped notebook with the fields we want to test against. */
const v3Notebook = (fields: Record<string, any>) => ({
  metadata: {
    name: 'V4 migration fixture',
    schema_version: '3.0',
  } as Record<string, unknown>,
  'ui-specification': {
    fields,
    fviews: {},
    viewsets: {},
    visible_types: [],
  },
});

describe('migrateToV4 — text fields', () => {
  test('MultipleTextField becomes TextField with multiline + rows preserved', () => {
    const nb = v3Notebook({
      Notes: {
        'component-namespace': 'formik-material-ui',
        'component-name': 'MultipleTextField',
        'type-returned': 'faims-core::String',
        'component-parameters': {
          label: 'Notes',
          required: false,
          InputProps: {rows: 7},
        },
        initialValue: '',
      },
    });

    const out = migrateToV4(nb)['ui-specification'].fields.Notes;
    expect(out['component-namespace']).toBe('faims-custom');
    expect(out['component-name']).toBe('TextField');
    expect(out['component-parameters'].multiline).toBe(true);
    expect(out['component-parameters'].rows).toBe(7);
    expect(out['component-parameters'].InputProps).toBeUndefined();
    expect(out['component-parameters'].label).toBe('Notes');
  });

  test('MultipleTextField with no InputProps.rows defaults to 4', () => {
    const nb = v3Notebook({
      Notes: {
        'component-namespace': 'formik-material-ui',
        'component-name': 'MultipleTextField',
        'type-returned': 'faims-core::String',
        'component-parameters': {label: 'Notes'},
        initialValue: '',
      },
    });
    const out = migrateToV4(nb)['ui-specification'].fields.Notes;
    expect(out['component-parameters'].rows).toBe(4);
  });

  test('FAIMSTextField is renamed to TextField, parameters preserved', () => {
    const original = {
      'component-namespace': 'faims-custom',
      'component-name': 'FAIMSTextField',
      'type-returned': 'faims-core::String',
      'component-parameters': {label: 'Short notes', required: true},
      initialValue: '',
    };
    const nb = v3Notebook({Short: {...original}});
    const out = migrateToV4(nb)['ui-specification'].fields.Short;
    expect(out['component-namespace']).toBe('faims-custom');
    expect(out['component-name']).toBe('TextField');
    expect(out['component-parameters'].label).toBe('Short notes');
    expect(out['component-parameters'].required).toBe(true);
    expect(out['component-parameters'].multiline).toBeUndefined();
  });

  test('FAIMSTextField with multiline already set is preserved on rename', () => {
    const original = {
      'component-namespace': 'faims-custom',
      'component-name': 'FAIMSTextField',
      'type-returned': 'faims-core::String',
      'component-parameters': {
        label: 'Long notes',
        multiline: true,
        rows: 6,
      },
      initialValue: '',
    };
    const nb = v3Notebook({Long: {...original}});
    const out = migrateToV4(nb)['ui-specification'].fields.Long;
    expect(out['component-name']).toBe('TextField');
    expect(out['component-parameters'].multiline).toBe(true);
    expect(out['component-parameters'].rows).toBe(6);
  });
});

describe('migrateToV4 — number fields', () => {
  test('ControlledNumber becomes NumberField with min/max + integer numberType', () => {
    const nb = v3Notebook({
      Count: {
        'component-namespace': 'faims-custom',
        'component-name': 'ControlledNumber',
        'type-returned': 'faims-core::Integer',
        'component-parameters': {
          label: 'Count',
          required: true,
          min: 1,
          max: 99,
        },
        initialValue: null,
      },
    });

    const out = migrateToV4(nb)['ui-specification'].fields.Count;
    expect(out['component-namespace']).toBe('faims-custom');
    expect(out['component-name']).toBe('NumberField');
    expect(out['type-returned']).toBe('faims-core::Number');
    expect(out['component-parameters'].numberType).toBe('integer');
    expect(out['component-parameters'].min).toBe(1);
    expect(out['component-parameters'].max).toBe(99);
    expect(out['component-parameters'].label).toBe('Count');
    expect(out['component-parameters'].required).toBe(true);
  });

  test('ControlledNumber with no min/max migrates without inventing limits', () => {
    const nb = v3Notebook({
      Count: {
        'component-namespace': 'faims-custom',
        'component-name': 'ControlledNumber',
        'type-returned': 'faims-core::Integer',
        'component-parameters': {label: 'Count'},
        initialValue: null,
      },
    });

    const out = migrateToV4(nb)['ui-specification'].fields.Count;
    expect(out['component-name']).toBe('NumberField');
    expect(out['component-parameters'].numberType).toBe('integer');
    expect(out['component-parameters'].min).toBeUndefined();
    expect(out['component-parameters'].max).toBeUndefined();
  });

  test('NumberField is left unchanged (already canonical)', () => {
    const original = {
      'component-namespace': 'faims-custom',
      'component-name': 'NumberField',
      'type-returned': 'faims-core::Number',
      'component-parameters': {
        label: 'Weight',
        numberType: 'floating',
        min: 0,
        max: 100.5,
      },
      initialValue: null,
    };
    const nb = v3Notebook({Weight: {...original}});
    const out = migrateToV4(nb)['ui-specification'].fields.Weight;
    expect(out['component-name']).toBe('NumberField');
    expect(out['component-parameters'].numberType).toBe('floating');
    expect(out['component-parameters'].min).toBe(0);
    expect(out['component-parameters'].max).toBe(100.5);
  });
});

describe('migrateToV4 — date / time fields', () => {
  test('DateTimeNow becomes DateTimePicker with show_now_button enabled', () => {
    const nb = v3Notebook({
      Captured: {
        'component-namespace': 'faims-custom',
        'component-name': 'DateTimeNow',
        'type-returned': 'faims-core::String',
        'component-parameters': {
          label: 'Captured at',
          required: true,
          is_auto_pick: true,
        },
        initialValue: '',
      },
    });

    const out = migrateToV4(nb)['ui-specification'].fields.Captured;
    expect(out['component-namespace']).toBe('faims-custom');
    expect(out['component-name']).toBe('DateTimePicker');
    expect(out['type-returned']).toBe('faims-core::String');
    expect(out['component-parameters'].show_now_button).toBe(true);
    expect(out['component-parameters'].isAutoPick).toBe(true);
    // Legacy snake_case key removed in favour of the canonical camelCase one.
    expect(out['component-parameters'].is_auto_pick).toBeUndefined();
    expect(out['component-parameters'].label).toBe('Captured at');
    expect(out['component-parameters'].required).toBe(true);
  });

  test('DateTimeNow without is_auto_pick still flips show_now_button on', () => {
    const nb = v3Notebook({
      Captured: {
        'component-namespace': 'faims-custom',
        'component-name': 'DateTimeNow',
        'type-returned': 'faims-core::String',
        'component-parameters': {label: 'Captured at'},
        initialValue: '',
      },
    });
    const out = migrateToV4(nb)['ui-specification'].fields.Captured;
    expect(out['component-name']).toBe('DateTimePicker');
    expect(out['component-parameters'].show_now_button).toBe(true);
    expect(out['component-parameters'].isAutoPick).toBeUndefined();
    expect(out['component-parameters'].is_auto_pick).toBeUndefined();
  });

  test('DateTimeNow with explicit isAutoPick is respected over legacy key', () => {
    const nb = v3Notebook({
      Captured: {
        'component-namespace': 'faims-custom',
        'component-name': 'DateTimeNow',
        'type-returned': 'faims-core::String',
        'component-parameters': {
          label: 'Captured',
          isAutoPick: false,
          is_auto_pick: true,
        },
        initialValue: '',
      },
    });
    const out = migrateToV4(nb)['ui-specification'].fields.Captured;
    expect(out['component-parameters'].isAutoPick).toBe(false);
    expect(out['component-parameters'].is_auto_pick).toBeUndefined();
  });

  test('DatePicker and MonthPicker pass through untouched', () => {
    const nb = v3Notebook({
      Day: {
        'component-namespace': 'faims-custom',
        'component-name': 'DatePicker',
        'type-returned': 'faims-core::Date',
        'component-parameters': {label: 'Day', show_now_button: false},
        initialValue: '',
      },
      Mo: {
        'component-namespace': 'faims-custom',
        'component-name': 'MonthPicker',
        'type-returned': 'faims-core::Date',
        'component-parameters': {label: 'Month'},
        initialValue: '',
      },
    });
    const out = migrateToV4(nb)['ui-specification'].fields;
    expect(out.Day['component-name']).toBe('DatePicker');
    expect(out.Day['component-parameters'].show_now_button).toBe(false);
    expect(out.Mo['component-name']).toBe('MonthPicker');
  });
});

describe('migrateToV4 — choice fields', () => {
  test('Checkbox becomes RadioGroup with synth Yes/No options', () => {
    const nb = v3Notebook({
      Agree: {
        'component-namespace': 'faims-custom',
        'component-name': 'Checkbox',
        'type-returned': 'faims-core::Bool',
        'component-parameters': {label: 'Agree?'},
        initialValue: true,
      },
    });

    const out = migrateToV4(nb)['ui-specification'].fields.Agree;
    expect(out['component-namespace']).toBe('faims-custom');
    expect(out['component-name']).toBe('RadioGroup');
    expect(out['type-returned']).toBe('faims-core::String');
    expect(out['component-parameters'].ElementProps.options).toEqual([
      {value: 'true', label: 'Yes'},
      {value: 'false', label: 'No'},
    ]);
    expect(out['component-parameters'].ElementProps.enableOtherOption).toBe(false);
    // true → 'true' so "Yes" is pre-selected after migration.
    expect(out.initialValue).toBe('true');
    expect(out['component-parameters'].label).toBe('Agree?');
  });

  test('Checkbox with initialValue false maps to empty string (no selection)', () => {
    const nb = v3Notebook({
      Agree: {
        'component-namespace': 'faims-custom',
        'component-name': 'Checkbox',
        'type-returned': 'faims-core::Bool',
        'component-parameters': {label: 'Agree?'},
        initialValue: false,
      },
    });
    const out = migrateToV4(nb)['ui-specification'].fields.Agree;
    expect(out.initialValue).toBe('');
  });

  test('Checkbox with pre-existing ElementProps.options is respected (no synth)', () => {
    const nb = v3Notebook({
      Custom: {
        'component-namespace': 'faims-custom',
        'component-name': 'Checkbox',
        'type-returned': 'faims-core::Bool',
        'component-parameters': {
          label: 'Custom checkbox',
          ElementProps: {
            options: [{value: 'agree', label: 'I agree'}],
          },
        },
        initialValue: false,
      },
    });
    const out = migrateToV4(nb)['ui-specification'].fields.Custom;
    expect(out['component-parameters'].ElementProps.options).toEqual([
      {value: 'agree', label: 'I agree'},
    ]);
  });

  test('Select is renamed to RadioGroup, ElementProps preserved unchanged', () => {
    const nb = v3Notebook({
      Pick: {
        'component-namespace': 'faims-custom',
        'component-name': 'Select',
        'type-returned': 'faims-core::String',
        'component-parameters': {
          label: 'Pick one',
          ElementProps: {
            enableOtherOption: true,
            options: [
              {value: 'a', label: 'A'},
              {value: 'b', label: 'B'},
            ],
          },
        },
        initialValue: '',
      },
    });

    const out = migrateToV4(nb)['ui-specification'].fields.Pick;
    expect(out['component-namespace']).toBe('faims-custom');
    expect(out['component-name']).toBe('RadioGroup');
    expect(out['type-returned']).toBe('faims-core::String');
    expect(out['component-parameters'].ElementProps.enableOtherOption).toBe(true);
    expect(out['component-parameters'].ElementProps.options).toHaveLength(2);
    expect(out['component-parameters'].ElementProps.options[0]).toEqual({
      value: 'a',
      label: 'A',
    });
  });

  test('MultiSelect passes through untouched', () => {
    const nb = v3Notebook({
      Many: {
        'component-namespace': 'faims-custom',
        'component-name': 'MultiSelect',
        'type-returned': 'faims-core::Array',
        'component-parameters': {
          label: 'Pick many',
          ElementProps: {options: [{value: 'x', label: 'X'}]},
        },
        initialValue: [],
      },
    });
    const out = migrateToV4(nb)['ui-specification'].fields.Many;
    expect(out['component-name']).toBe('MultiSelect');
  });

  test('RadioGroup passes through untouched (already canonical)', () => {
    const nb = v3Notebook({
      Pick: {
        'component-namespace': 'faims-custom',
        'component-name': 'RadioGroup',
        'type-returned': 'faims-core::String',
        'component-parameters': {
          label: 'Pick one',
          ElementProps: {options: [{value: 'a', label: 'A'}]},
        },
        initialValue: '',
      },
    });
    const out = migrateToV4(nb)['ui-specification'].fields.Pick;
    expect(out['component-name']).toBe('RadioGroup');
    expect(out['component-parameters'].ElementProps.options).toHaveLength(1);
  });
});

describe('migrateToV4 — schema_version + passthrough', () => {
  test('bumps schema_version to 4.0', () => {
    const nb = v3Notebook({});
    expect(migrateToV4(nb).metadata.schema_version).toBe('4.0');
  });

  test('leaves unrelated fields and metadata untouched', () => {
    const nb = v3Notebook({
      DateField: {
        'component-namespace': 'faims-custom',
        'component-name': 'DateTimePicker',
        'type-returned': 'faims-core::String',
        'component-parameters': {label: 'Date'},
        initialValue: '',
      },
      // MultiSelect is NOT consolidated in V4 — it's already the canonical
      // multi-choice runtime. Must pass through untouched.
      MultiField: {
        'component-namespace': 'faims-custom',
        'component-name': 'MultiSelect',
        'type-returned': 'faims-core::Array',
        'component-parameters': {
          label: 'Pick many',
          ElementProps: {options: [{value: 'a', label: 'A'}]},
        },
        initialValue: [],
      },
      // RadioGroup is already canonical — its `component-name` is the
      // surviving name for single-choice and must pass through unchanged.
      RadioField: {
        'component-namespace': 'faims-custom',
        'component-name': 'RadioGroup',
        'type-returned': 'faims-core::String',
        'component-parameters': {label: 'Pick', ElementProps: {options: []}},
        initialValue: '',
      },
    });
    nb.metadata.lead_institution = 'Fieldmark';

    const out = migrateToV4(nb);
    expect(out['ui-specification'].fields.DateField['component-name']).toBe(
      'DateTimePicker'
    );
    expect(out['ui-specification'].fields.MultiField['component-name']).toBe(
      'MultiSelect'
    );
    expect(out['ui-specification'].fields.RadioField['component-name']).toBe(
      'RadioGroup'
    );
    expect(out.metadata.lead_institution).toBe('Fieldmark');
  });

  test('does not mutate the input notebook', () => {
    const nb = v3Notebook({
      Notes: {
        'component-namespace': 'formik-material-ui',
        'component-name': 'MultipleTextField',
        'type-returned': 'faims-core::String',
        'component-parameters': {label: 'Notes', InputProps: {rows: 5}},
        initialValue: '',
      },
    });
    migrateToV4(nb);
    expect(nb['ui-specification'].fields.Notes['component-name']).toBe(
      'MultipleTextField'
    );
    expect(nb.metadata.schema_version).toBe('3.0');
  });
});

describe('migrateNotebook chains v2 → v3 → v4', () => {
  test('a 3.0 notebook is upgraded to 4.0', () => {
    const nb = v3Notebook({
      Notes: {
        'component-namespace': 'formik-material-ui',
        'component-name': 'MultipleTextField',
        'type-returned': 'faims-core::String',
        'component-parameters': {label: 'Notes', InputProps: {rows: 5}},
        initialValue: '',
      },
    });

    const {changed, migrated} = migrateNotebook(nb);
    expect(changed).toBe(true);
    expect(migrated.metadata.schema_version).toBe('4.0');
    expect(
      (migrated as any)['ui-specification'].fields.Notes['component-name']
    ).toBe('TextField');
  });

  test('already at 4.0 → no change', () => {
    const nb = v3Notebook({});
    nb.metadata.schema_version = '4.0';
    const {changed} = migrateNotebook(nb);
    expect(changed).toBe(false);
  });
});
