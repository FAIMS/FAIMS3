// SPDX-License-Identifier: Apache-2.0
import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {z} from 'zod';
import {Form, type Field} from './form';

const colorOptions = [
  {label: 'Blue', value: 'blue'},
  {label: 'Red', value: 'red'},
];

const renderSelectForm = (field: Field, defaultValue?: string) =>
  render(
    <Form
      fields={[field]}
      defaultValues={defaultValue ? {color: defaultValue} : undefined}
      onSubmit={vi.fn(async () => undefined)}
    />
  );

afterEach(cleanup);

describe('Form select clear', () => {
  it('shows a clear button for an optional select that has a value', () => {
    renderSelectForm(
      {
        name: 'color',
        label: 'Color',
        options: colorOptions,
        schema: z.string().optional(),
      },
      'blue'
    );
    expect(screen.getByRole('button', {name: 'Clear Color'})).toBeTruthy();
  });

  it('hides the clear button when nothing is selected', () => {
    renderSelectForm({
      name: 'color',
      label: 'Color',
      options: colorOptions,
      schema: z.string().optional(),
    });
    expect(screen.queryByRole('button', {name: 'Clear Color'})).toBeNull();
  });

  it('does not clear a required select', () => {
    renderSelectForm(
      {
        name: 'color',
        label: 'Color',
        options: colorOptions,
        schema: z.string(),
      },
      'blue'
    );
    expect(screen.queryByRole('button', {name: 'Clear Color'})).toBeNull();
  });

  it('lets a field opt out of clear when empty is a listed option', () => {
    renderSelectForm(
      {
        name: 'color',
        label: 'Color',
        options: [{label: 'No color', value: '__none__'}, ...colorOptions],
        schema: z.string(),
        clearable: false,
      },
      'blue'
    );
    expect(screen.queryByRole('button', {name: 'Clear Color'})).toBeNull();
  });

  it('lets a required select opt in to clear', () => {
    renderSelectForm(
      {
        name: 'color',
        label: 'Color',
        options: colorOptions,
        schema: z.string(),
        clearable: true,
      },
      'blue'
    );
    expect(screen.getByRole('button', {name: 'Clear Color'})).toBeTruthy();
  });

  it('resets the value when the clear button is pressed', async () => {
    const user = userEvent.setup();
    renderSelectForm(
      {
        name: 'color',
        label: 'Color',
        options: colorOptions,
        schema: z.string().optional(),
      },
      'blue'
    );
    await user.click(screen.getByRole('button', {name: 'Clear Color'}));
    expect(screen.queryByRole('button', {name: 'Clear Color'})).toBeNull();
    expect(screen.getByRole('combobox').textContent).toContain('Select Color');
  });
});
