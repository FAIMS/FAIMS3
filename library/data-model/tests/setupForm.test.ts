// SPDX-License-Identifier: Apache-2.0
import {
  SetupForm,
  SetupFormSchema,
  validateSetupValues,
} from '../src/uiSpecification/types';

const form: SetupForm = {
  fields: [
    {name: 'technician', label: 'Technician', type: 'string', required: true},
    {name: 'client', label: 'Client', type: 'string', required: true},
    {name: 'telephone', label: 'Telephone', type: 'number'},
    {name: 'siteAddress', label: 'Site Address', type: 'string'},
    {name: 'visitDate', label: 'Visit Date', type: 'date', required: true},
    {
      name: 'timeOnSite',
      label: 'Time on Site',
      type: 'select',
      required: true,
      options: ['8 am', 'Half Day'],
    },
    {
      name: 'testingRequired',
      label: 'Testing Required',
      type: 'multiselect',
      options: ['Water', 'Soil', 'Air'],
    },
    {name: 'notes', label: 'Notes', type: 'longtext'},
  ],
};

describe('SetupFormSchema', () => {
  test('accepts a valid form definition', () => {
    expect(SetupFormSchema.safeParse(form).success).toBe(true);
  });

  test('rejects an empty field list', () => {
    expect(SetupFormSchema.safeParse({fields: []}).success).toBe(false);
  });

  test('rejects an unknown field type', () => {
    const bad = {
      fields: [{name: 'x', label: 'X', type: 'colour'}],
    };
    expect(SetupFormSchema.safeParse(bad).success).toBe(false);
  });

  test('rejects a select field without options', () => {
    const bad = {fields: [{name: 'x', label: 'X', type: 'select'}]};
    expect(SetupFormSchema.safeParse(bad).success).toBe(false);
  });

  test('rejects a multiselect field with empty options', () => {
    const bad = {
      fields: [{name: 'x', label: 'X', type: 'multiselect', options: []}],
    };
    expect(SetupFormSchema.safeParse(bad).success).toBe(false);
  });
});

describe('validateSetupValues', () => {
  test('passes with all fields provided correctly', () => {
    const errors = validateSetupValues(form, {
      technician: 'Thomas Bevan',
      client: 'EFN',
      telephone: 41234567,
      siteAddress: '1 Example St',
      visitDate: '2026-07-20',
      timeOnSite: '8 am',
      testingRequired: ['Water', 'Air'],
    });
    expect(errors).toEqual([]);
  });

  test('passes when optional fields are omitted', () => {
    const errors = validateSetupValues(form, {
      technician: 'Thomas Bevan',
      client: 'EFN',
      visitDate: '2026-07-20',
      timeOnSite: 'Half Day',
    });
    expect(errors).toEqual([]);
  });

  test('fails when a required field is missing', () => {
    const errors = validateSetupValues(form, {
      client: 'EFN',
      visitDate: '2026-07-20',
      timeOnSite: '8 am',
    });
    expect(errors).toEqual(["'Technician' is required."]);
  });

  test('treats an empty string as missing for a required field', () => {
    const errors = validateSetupValues(form, {
      technician: '',
      client: 'EFN',
      visitDate: '2026-07-20',
      timeOnSite: '8 am',
    });
    expect(errors).toEqual(["'Technician' is required."]);
  });

  test('fails when a number field receives a string', () => {
    const errors = validateSetupValues(form, {
      technician: 'Thomas Bevan',
      client: 'EFN',
      telephone: '41234567',
      visitDate: '2026-07-20',
      timeOnSite: '8 am',
    });
    expect(errors).toEqual(["'Telephone' must be a number."]);
  });

  test('fails when a string field receives a number', () => {
    const errors = validateSetupValues(form, {
      technician: 'Thomas Bevan',
      client: 42,
      visitDate: '2026-07-20',
      timeOnSite: '8 am',
    });
    expect(errors).toEqual(["'Client' must be text."]);
  });

  test('fails when a select value is not among the options', () => {
    const errors = validateSetupValues(form, {
      technician: 'Thomas Bevan',
      client: 'EFN',
      visitDate: '2026-07-20',
      timeOnSite: 'Full Day',
    });
    expect(errors).toEqual([
      "'Time on Site' must be one of its listed options.",
    ]);
  });

  test('accepts a valid multiselect array', () => {
    const errors = validateSetupValues(form, {
      technician: 'Thomas Bevan',
      client: 'EFN',
      visitDate: '2026-07-20',
      timeOnSite: '8 am',
      testingRequired: ['Water', 'Air'],
    });
    expect(errors).toEqual([]);
  });

  test('fails when a multiselect array contains an unlisted option', () => {
    const errors = validateSetupValues(form, {
      technician: 'Thomas Bevan',
      client: 'EFN',
      visitDate: '2026-07-20',
      timeOnSite: '8 am',
      testingRequired: ['Water', 'Fire'],
    });
    expect(errors).toEqual([
      "'Testing Required' must be a list of its listed options.",
    ]);
  });

  test('treats an empty array as missing for a required multiselect', () => {
    const requiredMulti: SetupForm = {
      fields: [
        {
          name: 'testingRequired',
          label: 'Testing Required',
          type: 'multiselect',
          required: true,
          options: ['Water', 'Soil'],
        },
      ],
    };
    const errors = validateSetupValues(requiredMulti, {
      testingRequired: [],
    });
    expect(errors).toEqual(["'Testing Required' is required."]);
  });

  test('fails on unknown keys', () => {
    const errors = validateSetupValues(form, {
      technician: 'Thomas Bevan',
      client: 'EFN',
      visitDate: '2026-07-20',
      timeOnSite: '8 am',
      surprise: 'value',
    });
    expect(errors).toEqual(["Unexpected field 'surprise'."]);
  });

  test('accepts a valid ISO date', () => {
    const errors = validateSetupValues(form, {
      technician: 'Thomas Bevan',
      client: 'EFN',
      timeOnSite: '8 am',
      visitDate: '2026-07-20',
    });
    expect(errors).toEqual([]);
  });

  test('fails on a malformed date', () => {
    const errors = validateSetupValues(form, {
      technician: 'Thomas Bevan',
      client: 'EFN',
      timeOnSite: '8 am',
      visitDate: '17/07/2026',
    });
    expect(errors).toEqual(["'Visit Date' must be a date (YYYY-MM-DD)."]);
  });

  test('accepts multi-line longtext', () => {
    const errors = validateSetupValues(form, {
      technician: 'Thomas Bevan',
      client: 'EFN',
      timeOnSite: '8 am',
      visitDate: '2026-07-20',
      notes: 'Line one.\nLine two.',
    });
    expect(errors).toEqual([]);
  });

  test('reports multiple problems together', () => {
    const errors = validateSetupValues(form, {
      telephone: 'not a number',
      surprise: 'value',
    });
    expect(errors).toHaveLength(6);
    expect(errors).toContain("'Technician' is required.");
    expect(errors).toContain("'Client' is required.");
    expect(errors).toContain("'Visit Date' is required.");
    expect(errors).toContain("'Time on Site' is required.");
    expect(errors).toContain("'Telephone' must be a number.");
    expect(errors).toContain("Unexpected field 'surprise'.");
  });
});
