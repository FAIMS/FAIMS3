// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {FaimsForm} from './formModule/types';
import {writeFieldUpdates} from './utils';

type FormEntry = {data: unknown; annotation?: object};

/** A tanstack form stand-in exposing just the state and setter used here. */
const makeForm = (values: Record<string, FormEntry>) => {
  const setCalls: {field: string; value: unknown; runListeners: boolean}[] = [];
  const form = {
    state: {values},
    setFieldValue: (
      field: string,
      value: FormEntry,
      options?: {dontRunListeners?: boolean}
    ) => {
      values[field] = value;
      setCalls.push({
        field,
        value,
        runListeners: options?.dontRunListeners !== true,
      });
    },
  } as unknown as FaimsForm;
  return {form, values, setCalls};
};

describe('writeFieldUpdates', () => {
  it('writes each update into form state', () => {
    const {form, values} = makeForm({code: {data: 'OLD'}, id: {data: ''}});

    writeFieldUpdates({
      form,
      updates: {code: 'NEW', id: 'A1-NEW'},
      runListeners: false,
    });

    expect(values.code.data).toBe('NEW');
    expect(values.id.data).toBe('A1-NEW');
  });

  it('keeps the entry it overwrites, so an annotation survives', () => {
    const {form, values} = makeForm({
      code: {data: 'OLD', annotation: {annotation: 'checked'}},
    });

    writeFieldUpdates({form, updates: {code: 'NEW'}, runListeners: false});

    expect(values.code).toEqual({
      data: 'NEW',
      annotation: {annotation: 'checked'},
    });
  });

  it('clears a field with null, as a computed field does', () => {
    const {form, values} = makeForm({
      code: {data: 'OLD', annotation: {annotation: 'checked'}},
    });

    writeFieldUpdates({form, updates: {code: null}, runListeners: false});

    expect(values.code).toEqual({
      data: null,
      annotation: {annotation: 'checked'},
    });
  });

  it('adds a field form state does not hold yet', () => {
    const {form, values} = makeForm({});

    writeFieldUpdates({form, updates: {code: 'NEW'}, runListeners: false});

    expect(values.code).toEqual({data: 'NEW'});
  });

  it('passes the listener choice through, both ways', () => {
    const quiet = makeForm({code: {data: ''}});
    writeFieldUpdates({
      form: quiet.form,
      updates: {code: 'NEW'},
      runListeners: false,
    });
    expect(quiet.setCalls[0].runListeners).toBe(false);

    const loud = makeForm({code: {data: ''}});
    writeFieldUpdates({
      form: loud.form,
      updates: {code: 'NEW'},
      runListeners: true,
    });
    expect(loud.setCalls[0].runListeners).toBe(true);
  });

  it('touches nothing when there are no updates', () => {
    const {form, setCalls} = makeForm({code: {data: 'OLD'}});

    writeFieldUpdates({form, updates: {}, runListeners: false});

    expect(setCalls).toEqual([]);
  });
});
