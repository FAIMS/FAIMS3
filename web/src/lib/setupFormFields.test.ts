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
    const result = byName['setup__lead'].schema.safeParse('');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Lead surveyor is required.');
  });

  it('reports an unset required select as required', () => {
    const result = byName['setup__officer'].schema.safeParse(undefined);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Officer is required.');
  });

  it('reports an empty required date as required before malformed', () => {
    const result = byName['setup__date'].schema.safeParse('');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Survey date is required.');
  });

  it('still rejects a malformed date', () => {
    const result = byName['setup__date'].schema.safeParse('6/10/2026');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Survey date must be a date.');
  });

  it('accepts an omitted optional number', () => {
    expect(byName['setup__postcode'].schema.safeParse(undefined).success).toBe(
      true
    );
  });

  it('marks required fields and leaves optional ones unmarked', () => {
    expect(byName['setup__lead'].required).toBe(true);
    expect(byName['setup__postcode'].required).toBeUndefined();
    expect(byName['setup__tests__opt__Water'].required).toBe(true);
    expect(byName['setup__tests__opt__Air'].required).toBeUndefined();
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
    expect(gate?.isBlocked({setup__tests__opt__Air: true})).toBe(false);
  });

  it('collects ticked options into an array', () => {
    expect(
      collectSetupValues(form, {
        setup__tests__opt__Water: true,
        setup__tests__opt__Air: true,
      })
    ).toEqual({tests: ['Water', 'Air']});
  });
});
