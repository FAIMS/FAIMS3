// SPDX-License-Identifier: Apache-2.0
import '@testing-library/jest-dom/vitest';
import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {multiSelectFieldSpec} from '.';
import {OTHER_PREFIX} from '../../../hooks/useOtherOption';

type RenderParams = {
  expandedChecklist?: boolean;
  enableOtherOption?: boolean;
  otherOptionPosition?: number;
  exclusiveOptions?: string[];
  initialValue?: string[];
};

/** Render a controlled MultiSelect and capture the stored field values. */
function renderMultiSelectField({
  expandedChecklist,
  enableOtherOption = false,
  otherOptionPosition,
  exclusiveOptions = [],
  initialValue = [],
}: RenderParams = {}) {
  const setFieldDataCalls: string[][] = [];
  const user = userEvent.setup();

  const Wrapper = () => {
    const [value, setValue] = useState<string[]>(initialValue);

    return (
      <multiSelectFieldSpec.component
        name="choice-field"
        fieldId="choice-field"
        label="Choose options"
        required={false}
        helperText=""
        advancedHelperText=""
        disabled={false}
        ElementProps={{
          options: [
            {value: 'YES_ID', label: '**Yes**'},
            {value: 'NO_ID', label: 'No'},
            {value: 'NONE_ID', label: 'None of the above'},
          ],
          expandedChecklist,
          enableOtherOption,
          otherOptionPosition,
          exclusiveOptions,
        }}
        state={{value: {data: value}, meta: {errors: []}} as any}
        setFieldData={(nextOrUpdater: unknown) => {
          setValue(prev => {
            const next =
              typeof nextOrUpdater === 'function'
                ? (nextOrUpdater as (value: string[]) => string[])(prev)
                : (nextOrUpdater as string[]);
            setFieldDataCalls.push([...next]);
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
    );
  };

  render(<Wrapper />);
  return {user, setFieldDataCalls};
}

describe('MultiSelect field rendering', () => {
  it('defaults to expanded checklist mode', () => {
    renderMultiSelectField();

    expect(screen.getByRole('checkbox', {name: 'Yes'})).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('renders as a dropdown when expandedChecklist is false', () => {
    renderMultiSelectField({expandedChecklist: false});

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', {name: 'Yes'})
    ).not.toBeInTheDocument();
  });

  it('stores values rather than display labels in expanded mode', async () => {
    const {user, setFieldDataCalls} = renderMultiSelectField();

    await user.click(screen.getByRole('checkbox', {name: 'Yes'}));
    await user.click(screen.getByRole('checkbox', {name: 'No'}));

    expect(setFieldDataCalls.at(-1)).toEqual(['YES_ID', 'NO_ID']);
    expect(screen.getByRole('checkbox', {name: 'Yes'})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'No'})).toBeChecked();
  });

  it('stores values and renders display labels in dropdown mode', async () => {
    const {user, setFieldDataCalls} = renderMultiSelectField({
      expandedChecklist: false,
    });

    // Select an option from the dropdown.
    await user.click(screen.getByRole('combobox'));
    const listbox = await screen.findByRole('listbox');

    await user.click(within(listbox).getByRole('option', {name: /Yes/}));

    // The stored value must be the option value, not its display label.
    expect(setFieldDataCalls.at(-1)).toEqual(['YES_ID']);

    // Close the dropdown so the combobox is accessible again.
    await user.keyboard('{Escape}');

    // The dropdown displays the label rather than the stored value.
    expect(screen.getByRole('combobox')).toHaveTextContent('Yes');
    expect(screen.getByRole('combobox')).not.toHaveTextContent('YES_ID');
  });
});

describe('MultiSelect exclusive options', () => {
  it('clears other selections when an exclusive option is chosen', async () => {
    const {user, setFieldDataCalls} = renderMultiSelectField({
      exclusiveOptions: ['NONE_ID'],
    });

    await user.click(screen.getByRole('checkbox', {name: 'Yes'}));
    await user.click(screen.getByRole('checkbox', {name: 'None of the above'}));

    expect(setFieldDataCalls.at(-1)).toEqual(['NONE_ID']);
    expect(screen.getByRole('checkbox', {name: 'Yes'})).not.toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'No'})).toBeDisabled();
  });

  it('keeps only the exclusive value in dropdown mode', async () => {
    const {user, setFieldDataCalls} = renderMultiSelectField({
      expandedChecklist: false,
      exclusiveOptions: ['NONE_ID'],
    });

    await user.click(screen.getByRole('combobox'));

    await user.click(
      within(await screen.findByRole('listbox')).getByRole('option', {
        name: /Yes/,
      })
    );

    await user.click(
      within(await screen.findByRole('listbox')).getByRole('option', {
        name: /None of the above/,
      })
    );

    expect(setFieldDataCalls.at(-1)).toEqual(['NONE_ID']);
  });
});

describe('MultiSelect Other option', () => {
  it('stores Other-prefixed text in expanded mode alongside selected values', async () => {
    const {user, setFieldDataCalls} = renderMultiSelectField({
      enableOtherOption: true,
    });

    await user.click(screen.getByRole('checkbox', {name: 'Yes'}));
    await user.type(screen.getByPlaceholderText('Other'), 'Mango');

    expect(setFieldDataCalls.at(-1)).toEqual([
      'YES_ID',
      `${OTHER_PREFIX}Mango`,
    ]);
  });

  it('stores Other-prefixed text in dropdown mode', async () => {
    const {user, setFieldDataCalls} = renderMultiSelectField({
      enableOtherOption: true,
      expandedChecklist: false,
    });

    await user.click(screen.getByRole('combobox'));
    const listbox = await screen.findByRole('listbox');
    await user.type(within(listbox).getByPlaceholderText('Other'), 'Papaya');

    expect(setFieldDataCalls.at(-1)).toEqual([`${OTHER_PREFIX}Papaya`]);
  });
});

describe('MultiSelect value schema', () => {
  const createSchema = (enableOtherOption = false) =>
    multiSelectFieldSpec.fieldDataSchemaFunction!({
      required: true,
      ElementProps: {
        options: [
          {value: 'YES_ID', label: '**Yes**'},
          {value: 'NO_ID', label: 'No'},
        ],
        enableOtherOption,
      },
    } as any);

  it('accepts an array of predefined values', () => {
    expect(createSchema().safeParse(['YES_ID', 'NO_ID']).success).toBe(true);
  });

  it('rejects display labels and unknown IDs', () => {
    expect(createSchema().safeParse(['**Yes**']).success).toBe(false);
    expect(createSchema().safeParse(['MAYBE_ID']).success).toBe(false);
  });

  it('requires at least one selection', () => {
    expect(createSchema().safeParse([]).success).toBe(false);
  });

  it('accepts Other-prefixed values when Other is enabled', () => {
    expect(
      createSchema(true).safeParse([`${OTHER_PREFIX}Custom`]).success
    ).toBe(true);
  });

  it('rejects Other-prefixed values when Other is disabled', () => {
    expect(createSchema().safeParse([`${OTHER_PREFIX}Custom`]).success).toBe(
      false
    );
  });

  it('renders Markdown formatting in option labels', () => {
    renderMultiSelectField();

    const checkbox = screen.getByRole('checkbox', {name: 'Yes'});
    expect(checkbox).toBeInTheDocument();

    expect(screen.getByText('Yes', {selector: 'strong'})).toBeInTheDocument();
  });

  it('disables the Other input when an exclusive option is selected', async () => {
    const {user, setFieldDataCalls} = renderMultiSelectField({
      enableOtherOption: true,
      exclusiveOptions: ['NONE_ID'],
    });

    await user.click(screen.getByRole('checkbox', {name: 'None of the above'}));

    const otherInput = screen.getByPlaceholderText('Other');
    expect(otherInput).toBeDisabled();

    await user.click(otherInput);

    expect(setFieldDataCalls.at(-1)).toEqual(['NONE_ID']);
    expect(otherInput).toHaveValue('');
  });
});
