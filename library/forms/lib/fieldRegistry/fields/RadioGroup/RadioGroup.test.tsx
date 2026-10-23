// SPDX-License-Identifier: Apache-2.0
import '@testing-library/jest-dom/vitest';
import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {radioGroupFieldSpec} from '.';
import {OTHER_PREFIX} from '../../../hooks/useOtherOption';

type RenderParams = {
  expandedChecklist?: boolean;
  enableOtherOption?: boolean;
  initialValue?: string;
};

function renderRadioGroupField({
  expandedChecklist,
  enableOtherOption = false,
  initialValue = '',
}: RenderParams = {}) {
  const setFieldDataCalls: string[] = [];
  const user = userEvent.setup();

  const Wrapper = () => {
    const [value, setValue] = useState(initialValue);

    return (
      <radioGroupFieldSpec.component
        name="choice-field"
        fieldId="choice-field"
        label="Choose one option"
        required={false}
        helperText=""
        advancedHelperText=""
        disabled={false}
        ElementProps={{
          options: [
            {id: 'yes', value: 'yes', label: 'Yes'},
            {id: 'no', value: 'no', label: 'No'},
          ],
          expandedChecklist,
          enableOtherOption,
        }}
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
    );
  };

  render(<Wrapper />);

  return {user, setFieldDataCalls};
}

describe('RadioGroup field rendering', () => {
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
});
