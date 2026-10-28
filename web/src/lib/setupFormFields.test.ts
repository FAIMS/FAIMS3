// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import type {SetupForm} from '@faims3/data-model';
import {
  collectSetupValues,
  setupFieldsToFormFields,
  setupSubmissionGate,
} from './setupFormFields';

const form: SetupForm = {
  fields: [
    {name: 'lead', label: 'Lead surveyor', type: 'string', required: true},
    {name: 'postcode', label: 'Postcode', type: 'number'},
    {name: 'date', label: 'Survey date', type: 'date', required: true},
    {
      name: 'officer',
      label: 'Officer',
      type: 'select',
      required: true,
      options: ['Alpha', 'Bravo'],
    },
    {
      name: 'tests',
      label: 'Testing required',
      type: 'multiselect',
      required: true,
      options: ['Water', 'Air'],
    },
  ],
};

describe('setupFieldsToFormFields', () => {
  const byName = Object.fromEntries(
    setupFieldsToFormFields(form).map(f => [f.name, f])
  );

  it('reports a required text field as required, not as a type error', () => {
    const result = byName['setup__0'].schema.safeParse('');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Lead surveyor is required.');
  });

  it('reports an unset required select as required', () => {
    const result = byName['setup__3'].schema.safeParse(undefined);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Officer is required.');
  });

  it('reports an empty required date as required before malformed', () => {
    const result = byName['setup__2'].schema.safeParse('');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Survey date is required.');
  });

  it('still rejects a malformed date', () => {
    const result = byName['setup__2'].schema.safeParse('6/10/2026');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Survey date must be a date.');
  });

  it('accepts an omitted optional number', () => {
    expect(byName['setup__1'].schema.safeParse(undefined).success).toBe(true);
  });

  it('marks required fields and leaves optional ones unmarked', () => {
    expect(byName['setup__0'].required).toBe(true);
    expect(byName['setup__1'].required).toBeUndefined();
    expect(byName['setup__4__opt__0'].required).toBe(true);
    expect(byName['setup__4__opt__1'].required).toBeUndefined();
  });

  it('maps longtext to a textarea control', () => {
    const notes: SetupForm = {
      fields: [{name: 'notes', label: 'Notes', type: 'longtext'}],
    };
    expect(setupFieldsToFormFields(notes)[0].type).toBe('textarea');
  });

  it('does not put dots from names or options into form field names', () => {
    const dotted: SetupForm = {
      fields: [
        {name: 'site.location', label: 'Site', type: 'string'},
        {
          name: 'time',
          label: 'Time',
          type: 'multiselect',
          required: true,
          options: ['8 a.m.', 'Half Day'],
        },
      ],
    };
    const names = setupFieldsToFormFields(dotted).map(f => f.name);
    expect(names).toEqual(['setup__0', 'setup__1__opt__0', 'setup__1__opt__1']);
    expect(names.every(name => !name.includes('.'))).toBe(true);
  });
});

describe('setupSubmissionGate', () => {
  it('is undefined when no multiselect is required', () => {
    const noMulti: SetupForm = {fields: form.fields.slice(0, 4)};
    expect(setupSubmissionGate(noMulti)).toBeUndefined();
  });

  it('blocks until a required multiselect has a tick, naming the field', () => {
    const gate = setupSubmissionGate(form);
    expect(gate?.reason).toBe(
      'Select at least one option for: Testing required.'
    );
    expect(gate?.isBlocked({})).toBe(true);
    expect(gate?.isBlocked({setup__4__opt__1: true})).toBe(false);
  });

  it('collects ticked options into an array', () => {
    expect(
      collectSetupValues(form, {
        setup__4__opt__0: true,
        setup__4__opt__1: true,
      })
    ).toEqual({tests: ['Water', 'Air']});
  });

  it('collects ticked options whose labels contain dots', () => {
    const dotted: SetupForm = {
      fields: [
        {
          name: 'time',
          label: 'Time',
          type: 'multiselect',
          required: true,
          options: ['8 a.m.', 'Half Day'],
        },
      ],
    };
    expect(collectSetupValues(dotted, {setup__0__opt__0: true})).toEqual({
      time: ['8 a.m.'],
    });
    expect(
      setupSubmissionGate(dotted)?.isBlocked({setup__0__opt__0: true})
    ).toBe(false);
  });
});
