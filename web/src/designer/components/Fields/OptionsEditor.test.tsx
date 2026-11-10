// SPDX-License-Identifier: Apache-2.0
// @vitest-environment jsdom

import {fireEvent, render, screen, within} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {OptionsEditor} from './OptionsEditor';

// Keep these tests focused on the editor rather than the Redux store or MDX editor.
const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  state: undefined as unknown,
}));

vi.mock('../../state/hooks', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector(mocks.state),
  useAppDispatch: () => mocks.dispatch,
}));

vi.mock('./BaseFieldEditor', () => ({
  BaseFieldEditor: ({children}: {children: React.ReactNode}) => <>{children}</>,
}));

vi.mock('../mdx-editor', () => ({
  MdxEditor: ({
    initialMarkdown,
    handleChange,
  }: {
    initialMarkdown: string;
    handleChange: (value: string) => void;
  }) => (
    <textarea
      aria-label="Markdown display label"
      defaultValue={initialMarkdown}
      onChange={event => handleChange(event.target.value)}
    />
  ),
}));

vi.mock('../../domain/conditions/conditionReferences', () => ({
  findOptionReferences: () => [],
  updateConditionReferences: (condition: unknown) => condition,
}));

vi.mock('../../domain/notebook/fieldFactory', () => ({
  cloneField: (field: unknown) => JSON.parse(JSON.stringify(field)),
}));

vi.mock('../../store/slices/uiSpec', () => ({
  fieldUpdated: (payload: unknown) => ({type: 'fieldUpdated', payload}),
  sectionConditionChanged: (payload: unknown) => ({
    type: 'sectionConditionChanged',
    payload,
  }),
}));

type Option = {value: string; label: string};

type UpdatedField = {
  'component-parameters': {
    ElementProps: {
      options: Option[];
      otherOptionPosition?: number;
      enableOtherOption?: boolean;
      exclusiveOptions?: string[];
    };
  };
};

const initialOptions: Option[] = [
  {value: 'A', label: 'Option A'},
  {value: 'B', label: 'Option B'},
  {value: 'C', label: 'Option C'},
];

function setup({
  options = initialOptions,
  enableOther = false,
  otherPosition,
  exclusiveOptions = [],
}: {
  options?: Option[];
  enableOther?: boolean;
  otherPosition?: number;
  exclusiveOptions?: string[];
} = {}) {
  const field = {
    'component-name': 'MultiSelect',
    'component-parameters': {
      ElementProps: {
        options,
        exclusiveOptions,
        enableOtherOption: enableOther,
        ...(otherPosition !== undefined
          ? {otherOptionPosition: otherPosition}
          : {}),
      },
    },
  };

  mocks.state = {
    notebook: {
      uiSpec: {present: {fields: {testField: field}, views: {}}},
    },
  };

  return render(<OptionsEditor fieldName="testField" />);
}

function latestField(): UpdatedField {
  const action = mocks.dispatch.mock.lastCall?.[0] as
    | {type: string; payload: {newField: UpdatedField}}
    | undefined;
  expect(action?.type).toBe('fieldUpdated');
  return action!.payload.newField;
}

function add(value: string) {
  fireEvent.change(screen.getByPlaceholderText('Add option'), {
    target: {value},
  });
  fireEvent.click(screen.getByRole('button', {name: /^Add$/}));
}

function optionRow(value: string) {
  const cell = screen.getByText(value, {exact: true});
  const row = cell.closest('tr');
  if (!row) throw new Error(`Cannot find option row for ${value}`);
  return within(row);
}

function otherRow() {
  const row = screen.getByText('(allows custom text input)').closest('tr');
  if (!row) throw new Error('Cannot find Other row');
  return within(row);
}

describe('OptionsEditor', () => {
  beforeEach(() => {
    mocks.dispatch.mockReset();
  });

  it('trims a new export value and defaults its display label to that value', () => {
    setup();
    add('  D  ');

    expect(latestField()['component-parameters'].ElementProps.options).toEqual([
      ...initialOptions,
      {value: 'D', label: 'D'},
    ]);
    expect(
      (screen.getByPlaceholderText('Add option') as HTMLInputElement).value
    ).toBe('');
  });

  it('rejects duplicate export values, ignoring case and surrounding whitespace', () => {
    setup();
    add('  a  ');

    expect(screen.getByText(/This export value already exists/)).toBeTruthy();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it('rejects a new value that duplicates another option’s display label', () => {
    setup();
    add('Option A');

    expect(screen.getByText(/This display label already exists/)).toBeTruthy();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it('keeps Other last when adding a new choice', () => {
    setup({enableOther: true, otherPosition: 3});
    add('D');

    const props = latestField()['component-parameters'].ElementProps;
    expect(props.options.map(option => option.value)).toEqual([
      'A',
      'B',
      'C',
      'D',
    ]);
    expect(props.otherOptionPosition).toBe(4);
  });

  it('preserves Other’s middle position when adding a new choice', () => {
    setup({enableOther: true, otherPosition: 1});
    add('D');

    expect(
      latestField()['component-parameters'].ElementProps.otherOptionPosition
    ).toBe(1);
  });

  it('moves Other up using the row action', () => {
    setup({enableOther: true, otherPosition: 3});
    fireEvent.click(otherRow().getByRole('button', {name: 'Move up'}));

    const props = latestField()['component-parameters'].ElementProps;
    expect(props.otherOptionPosition).toBe(2);
    expect(props.options).toEqual(initialOptions);
  });

  it('shifts Other’s index when deleting an option above it', () => {
    setup({enableOther: true, otherPosition: 3});
    fireEvent.click(
      optionRow('A').getByRole('button', {name: 'Delete option'})
    );

    const props = latestField()['component-parameters'].ElementProps;
    expect(props.options.map(option => option.value)).toEqual(['B', 'C']);
    expect(props.otherOptionPosition).toBe(2);
  });

  it('updates the export value and Markdown label independently', () => {
    setup({exclusiveOptions: ['A']});
    fireEvent.click(optionRow('A').getByRole('button', {name: 'Edit option'}));

    fireEvent.change(
      screen.getByPlaceholderText('Enter a unique export value'),
      {
        target: {value: 'updated-a'},
      }
    );
    fireEvent.change(
      screen.getByRole('textbox', {name: 'Markdown display label'}),
      {
        target: {value: '**New label**'},
      }
    );
    fireEvent.click(screen.getByRole('button', {name: 'Save'}));

    const props = latestField()['component-parameters'].ElementProps;
    expect(props.options[0]).toEqual({
      value: 'updated-a',
      label: '**New label**',
    });
    expect(props.exclusiveOptions).toEqual(['updated-a']);
  });

  it('adds the first option from an empty list without throwing', () => {
    setup({options: []});

    expect(screen.getByPlaceholderText('Add option')).toBeTruthy();
    expect(screen.getByRole('button', {name: /^Add$/})).toBeTruthy();
    expect(() => add('First')).not.toThrow();
    expect(latestField()['component-parameters'].ElementProps.options).toEqual([
      {value: 'First', label: 'First'},
    ]);
  });
});
