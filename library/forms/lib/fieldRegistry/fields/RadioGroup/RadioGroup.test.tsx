// SPDX-License-Identifier: Apache-2.0
import '@testing-library/jest-dom/vitest';
import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {radioGroupFieldSpec, selectFieldSpec} from '.';
import {OTHER_PREFIX} from '../../../hooks/useOtherOption';

type RenderParams = {
  expandedChecklist?: boolean;
  enableOtherOption?: boolean;
  initialValue?: string;
  options?: Array<{
    value: string;
    label: string;
    condition?: {operator: string; field?: string; value?: unknown};
  }>;
  conditionValues?: Record<string, unknown>;
};

const defaultOptions = [
  {value: 'yes', label: 'Yes'},
  {value: 'no', label: 'No'},
];

function renderRadioGroupField({
  expandedChecklist,
  enableOtherOption = false,
  initialValue = '',
  options = defaultOptions,
  conditionValues,
}: RenderParams = {}) {
  const setFieldDataCalls: string[] = [];
  const user = userEvent.setup();

  const Wrapper = () => {
    const [value, setValue] = useState(initialValue);
    const [liveConditionValues, setLiveConditionValues] = useState(
      conditionValues ?? {}
    );

    return (
      <>
        <button
          type="button"
          onClick={() => setLiveConditionValues({'site-type': 'industrial'})}
        >
          set-industrial
        </button>
        <button
          type="button"
          onClick={() => setLiveConditionValues({'site-type': 'residential'})}
        >
          set-residential
        </button>
        <radioGroupFieldSpec.component
          name="choice-field"
          fieldId="choice-field"
          label="Choose one option"
          required={false}
          helperText=""
          advancedHelperText=""
          disabled={false}
          ElementProps={{
            options,
            expandedChecklist,
            enableOtherOption,
          }}
          conditionValues={liveConditionValues}
          state={{value: {data: value}, meta: {errors: []}} as any}
          setFieldData={(nextOrUpdater: unknown) => {
            setValue(prev => {
              const next =
                typeof nextOrUpdater === 'function'
                  ? (nextOrUpdater as (value: string) => string)(prev)
                  : String(nextOrUpdater);
              setFieldDataCalls.push(next);
              return next;
            });
          }}
          setFieldAnnotation={vi.fn()}
          addAttachment={vi.fn(async () => 'attachment-id')}
          removeAttachment={vi.fn(async () => undefined)}
          handleBlur={vi.fn()}
          trigger={{commit: vi.fn(async () => undefined)}}
          config={{} as any}
        />
      </>
    );
  };

  render(<Wrapper />);

  return {user, setFieldDataCalls};
}

const conditionedOptions = [
  {value: 'none', label: 'None observed'},
  {
    value: 'asbestos',
    label: 'Asbestos',
    condition: {operator: 'equal', field: 'site-type', value: 'industrial'},
  },
];

describe('RadioGroup field rendering', () => {
  it('legacy Select uses the same RadioGroup component for option filtering', () => {
    expect(selectFieldSpec.component).toBe(radioGroupFieldSpec.component);
  });

  it('defaults to expanded checklist rendering when expandedChecklist is not provided', () => {
    renderRadioGroupField();

    expect(screen.getByRole('radio', {name: 'Yes'})).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('renders as a dropdown when expandedChecklist is false', () => {
    renderRadioGroupField({expandedChecklist: false});

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.queryByRole('radio', {name: 'Yes'})).not.toBeInTheDocument();
  });
});

describe('RadioGroup Other option', () => {
  it('stores an Other-prefixed value in expanded checklist mode and allows switching back to a standard option', async () => {
    const {user, setFieldDataCalls} = renderRadioGroupField({
      enableOtherOption: true,
      expandedChecklist: true,
    });

    const otherInput = screen.getByPlaceholderText('Other');
    await user.type(otherInput, 'Mango');

    expect(setFieldDataCalls.at(-1)).toBe(`${OTHER_PREFIX}Mango`);

    await user.click(screen.getByRole('radio', {name: 'Yes'}));

    expect(setFieldDataCalls.at(-1)).toBe('yes');
    expect(screen.getByPlaceholderText('Other')).toHaveValue('');
  });

  it('stores an Other-prefixed value in dropdown mode', async () => {
    const {user, setFieldDataCalls} = renderRadioGroupField({
      enableOtherOption: true,
      expandedChecklist: false,
    });

    await user.click(screen.getByRole('combobox'));
    const listbox = await screen.findByRole('listbox');
    const otherInput = within(listbox).getByPlaceholderText('Other');

    await user.type(otherInput, 'Papaya');

    expect(setFieldDataCalls.at(-1)).toBe(`${OTHER_PREFIX}Papaya`);
  });
});

describe('RadioGroup value schema', () => {
  const schema = radioGroupFieldSpec.fieldDataSchemaFunction!({
    required: true,
    ElementProps: {
      options: [
        {value: 'yes', label: 'Yes'},
        {value: 'no', label: 'No'},
      ],
      enableOtherOption: true,
    },
  } as any);

  it('accepts values entered through the Other option', () => {
    expect(schema.safeParse(`${OTHER_PREFIX}Custom value`).success).toBe(true);
  });

  it('rejects values outside the option list that are not Other-prefixed', () => {
    expect(schema.safeParse('maybe').success).toBe(false);
  });

  it('accepts a stored value that is in the full options list even when that option is currently filtered', () => {
    const conditionedSchema = radioGroupFieldSpec.fieldDataSchemaFunction!({
      required: true,
      ElementProps: {
        options: conditionedOptions,
      },
    } as any);
    expect(conditionedSchema.safeParse('asbestos').success).toBe(true);
  });
});

describe('RadioGroup option conditions', () => {
  it('hides a false-condition option in expanded checklist and shows it when the sibling matches', async () => {
    const {user} = renderRadioGroupField({
      expandedChecklist: true,
      options: conditionedOptions,
      conditionValues: {'site-type': 'residential'},
    });

    expect(
      screen.getByRole('radio', {name: 'None observed'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('radio', {name: 'Asbestos'})
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', {name: 'set-industrial'}));

    expect(screen.getByRole('radio', {name: 'Asbestos'})).toBeInTheDocument();
  });

  it('hides a false-condition option in dropdown and shows it when the sibling matches', async () => {
    const {user} = renderRadioGroupField({
      expandedChecklist: false,
      options: conditionedOptions,
      conditionValues: {'site-type': 'residential'},
    });

    await user.click(screen.getByRole('combobox'));
    let listbox = await screen.findByRole('listbox');
    expect(
      within(listbox).getByRole('option', {name: 'None observed'})
    ).toBeInTheDocument();
    expect(
      within(listbox).queryByRole('option', {name: 'Asbestos'})
    ).not.toBeInTheDocument();

    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', {name: 'set-industrial'}));
    await user.click(screen.getByRole('combobox'));
    listbox = await screen.findByRole('listbox');
    expect(
      within(listbox).getByRole('option', {name: 'Asbestos'})
    ).toBeInTheDocument();
  });

  it('keeps a selected option whose condition is now false visible and does not auto-clear', async () => {
    const {user, setFieldDataCalls} = renderRadioGroupField({
      expandedChecklist: true,
      options: conditionedOptions,
      initialValue: 'asbestos',
      conditionValues: {'site-type': 'industrial'},
    });

    const asbestos = screen.getByRole('radio', {name: 'Asbestos'});
    expect(asbestos).toBeInTheDocument();
    expect(asbestos).toBeChecked();

    const callsBefore = setFieldDataCalls.length;
    await user.click(screen.getByRole('button', {name: 'set-residential'}));
    expect(setFieldDataCalls.length).toBe(callsBefore);
    expect(screen.getByRole('radio', {name: 'Asbestos'})).toBeChecked();
  });
});
