// SPDX-License-Identifier: Apache-2.0
import '@testing-library/jest-dom/vitest';
import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {multiSelectFieldSpec} from '.';

type RenderParams = {
  expandedChecklist?: boolean;
  initialValue?: string[];
  options?: Array<{
    value: string;
    label: string;
    condition?: {operator: string; field?: string; value?: unknown};
  }>;
  conditionValues?: Record<string, unknown>;
  exclusiveOptions?: string[];
};

const conditionedOptions = [
  {value: 'none', label: 'None observed'},
  {
    value: 'asbestos',
    label: 'Asbestos',
    condition: {operator: 'equal', field: 'site-type', value: 'industrial'},
  },
];

function renderMultiSelectField({
  expandedChecklist = true,
  initialValue = [],
  options = conditionedOptions,
  conditionValues,
  exclusiveOptions,
}: RenderParams = {}) {
  const setFieldDataCalls: unknown[] = [];
  const user = userEvent.setup();

  const Wrapper = () => {
    const [value, setValue] = useState<string[]>(initialValue);
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
        <multiSelectFieldSpec.component
          name="hazards"
          fieldId="hazards"
          label="Hazards"
          required={false}
          helperText=""
          advancedHelperText=""
          disabled={false}
          ElementProps={{
            options,
            expandedChecklist,
            exclusiveOptions,
          }}
          conditionValues={liveConditionValues}
          state={{value: {data: value}, meta: {errors: []}} as any}
          setFieldData={(nextOrUpdater: unknown) => {
            setValue(prev => {
              const next =
                typeof nextOrUpdater === 'function'
                  ? (nextOrUpdater as (value: string[]) => string[])(prev)
                  : (nextOrUpdater as string[]);
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

describe('MultiSelect option conditions', () => {
  it('hides a false-condition option in expanded checklist and shows it when the sibling matches', async () => {
    const {user} = renderMultiSelectField({
      expandedChecklist: true,
      conditionValues: {'site-type': 'residential'},
    });

    expect(
      screen.getByRole('checkbox', {name: 'None observed'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', {name: 'Asbestos'})
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', {name: 'set-industrial'}));

    expect(
      screen.getByRole('checkbox', {name: 'Asbestos'})
    ).toBeInTheDocument();
  });

  it('hides a false-condition option in dropdown and shows it when the sibling matches', async () => {
    const {user} = renderMultiSelectField({
      expandedChecklist: false,
      conditionValues: {'site-type': 'residential'},
    });

    await user.click(screen.getByRole('combobox'));
    let listbox = await screen.findByRole('listbox');
    expect(
      within(listbox).getByRole('option', {name: /None observed/})
    ).toBeInTheDocument();
    expect(
      within(listbox).queryByRole('option', {name: /Asbestos/})
    ).not.toBeInTheDocument();

    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', {name: 'set-industrial'}));
    await user.click(screen.getByRole('combobox'));
    listbox = await screen.findByRole('listbox');
    expect(
      within(listbox).getByRole('option', {name: /Asbestos/})
    ).toBeInTheDocument();
  });

  it('keeps a selected member whose condition is now false visible and does not auto-clear', async () => {
    const {user, setFieldDataCalls} = renderMultiSelectField({
      expandedChecklist: true,
      initialValue: ['asbestos'],
      conditionValues: {'site-type': 'residential'},
    });

    const asbestos = screen.getByRole('checkbox', {name: 'Asbestos'});
    expect(asbestos).toBeInTheDocument();
    expect(asbestos).toBeChecked();

    const callsBefore = setFieldDataCalls.length;
    await user.click(screen.getByRole('button', {name: 'set-residential'}));
    expect(setFieldDataCalls.length).toBe(callsBefore);
    expect(screen.getByRole('checkbox', {name: 'Asbestos'})).toBeChecked();
  });
});

describe('MultiSelect value schema', () => {
  const schema = multiSelectFieldSpec.fieldDataSchemaFunction!({
    required: false,
    ElementProps: {
      options: conditionedOptions,
    },
  } as any);

  it('accepts a stored member that is in the full options list even when that option is currently filtered', () => {
    expect(schema.safeParse(['asbestos']).success).toBe(true);
  });
});
