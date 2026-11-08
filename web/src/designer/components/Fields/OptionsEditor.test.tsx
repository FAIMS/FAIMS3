// SPDX-License-Identifier: Apache-2.0

import {ChoiceElementProps, ChoiceOption} from '@faims3/forms';
import {ThemeProvider} from '@mui/material/styles';
import {ToolkitStore} from '@reduxjs/toolkit/dist/configureStore';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {ReactNode} from 'react';
import {Provider} from 'react-redux';
import {describe, expect, it, vi} from 'vitest';
import {createDesignerStore} from '../../createDesignerStore';
import {getFieldSpec} from '../../fields';
import {DesignerEditingProvider} from '../../state/editing-context';
import {
  AppState,
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  FieldType,
} from '../../state/initial';
import {loaded} from '../../store/slices/uiSpec';
import globalTheme from '../../theme/index';
import {ConditionType} from '../../types/condition';
import {OptionsEditor} from './OptionsEditor';

type ChoiceComponentParameters = {ElementProps?: Partial<ChoiceElementProps>};

const choiceParams = (field: FieldType): Partial<ChoiceElementProps> => {
  const params = field['component-parameters'] as ChoiceComponentParameters;
  params.ElementProps ??= {};
  return params.ElementProps;
};

vi.mock('../mdx-editor', () => ({
  MdxEditor: () => null,
}));

const SITE_TYPE = 'site-type';
const HAZARDS = 'hazards';
const NOTES = 'notes';
const INDUSTRIAL_CONDITION: ConditionType = {
  operator: 'equal',
  field: SITE_TYPE,
  value: 'Industrial',
};

const WithProviders = ({
  children,
  store,
}: {
  children: ReactNode;
  store: ToolkitStore<AppState>;
}) => (
  <ThemeProvider theme={globalTheme}>
    <Provider store={store}>
      <DesignerEditingProvider value={{originalFieldIdentifiers: new Set()}}>
        {children}
      </DesignerEditingProvider>
    </Provider>
  </ThemeProvider>
);

function choiceField(
  specName: 'RadioGroup' | 'MultiSelect',
  id: string,
  label: string,
  options: ChoiceOption[]
): FieldType {
  const field = getFieldSpec(specName);
  field['component-parameters'].name = id;
  field['component-parameters'].label = label;
  field.exportName = id;
  const elementProps = choiceParams(field);
  elementProps.options = options;
  elementProps.enableOtherOption = false;
  return field;
}

function storeWithChoiceFields(opts?: {
  enableOther?: boolean;
  optionCondition?: boolean;
  exclusive?: boolean;
}) {
  const store = createDesignerStore();
  const siteType = choiceField('RadioGroup', SITE_TYPE, 'Site type', [
    {label: 'Industrial', value: 'Industrial'},
    {label: 'Residential', value: 'Residential'},
  ]);
  const hazards = choiceField('MultiSelect', HAZARDS, 'Hazards', [
    {label: 'None observed', value: 'None observed'},
    {
      label: 'Asbestos',
      value: 'Asbestos',
      ...(opts?.optionCondition ? {condition: INDUSTRIAL_CONDITION} : {}),
    },
  ]);
  if (opts?.enableOther) {
    choiceParams(hazards).enableOtherOption = true;
  }
  if (opts?.exclusive) {
    choiceParams(hazards).exclusiveOptions = [];
  }

  const notes = getFieldSpec('TextField');
  notes['component-parameters'].name = NOTES;
  notes['component-parameters'].label = 'Notes';
  notes.exportName = NOTES;
  notes.condition = INDUSTRIAL_CONDITION;

  store.dispatch(
    loaded({
      fields: {
        [SITE_TYPE]: siteType,
        [HAZARDS]: hazards,
        [NOTES]: notes,
      },
      views: {
        sectionA: {
          label: 'Section A',
          fields: [SITE_TYPE, HAZARDS, NOTES],
          condition: INDUSTRIAL_CONDITION,
        },
      },
      viewsets: {
        formA: {label: 'Form A', views: ['sectionA'], summary_fields: []},
      },
      visible_types: ['formA'],
      settings: {showQrCodeButton: false},
      schemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
    })
  );
  return store;
}

function getOptions(store: ToolkitStore<AppState>, fieldId: string) {
  return (
    (
      store.getState().notebook.uiSpec.present.fields[fieldId][
        'component-parameters'
      ] as ChoiceComponentParameters
    ).ElementProps?.options ?? []
  );
}

function optionRow(label: string) {
  return screen.getByText(label).closest('tr') as HTMLElement;
}

function optionIconButton(label: string, iconTestId: string) {
  return within(optionRow(label))
    .getByTestId(iconTestId)
    .closest('button') as HTMLButtonElement;
}

describe('OptionsEditor option conditions', () => {
  it('shows an Actions-column condition icon on ordinary rows and not on Other', () => {
    const store = storeWithChoiceFields({enableOther: true});
    render(
      <WithProviders store={store}>
        <OptionsEditor fieldName={HAZARDS} showExclusiveOptions />
      </WithProviders>
    );

    const asbestosRow = optionRow('Asbestos');
    expect(
      within(asbestosRow).getByRole('button', {name: 'Add condition'})
    ).toBeDefined();
    expect(within(asbestosRow).queryByText('Add condition')).toBeNull();
    expect(within(asbestosRow).queryByText('Update condition')).toBeNull();

    const otherRow = screen
      .getByText(/allows custom text input/)
      .closest('tr') as HTMLElement;
    expect(
      within(otherRow).queryByRole('button', {name: 'Add condition'})
    ).toBeNull();
  });

  it('saves, reloads, and updates the compact control to Update condition', async () => {
    const store = storeWithChoiceFields();
    const user = userEvent.setup();
    render(
      <WithProviders store={store}>
        <OptionsEditor fieldName={HAZARDS} />
      </WithProviders>
    );

    await user.click(
      within(optionRow('Asbestos')).getByRole('button', {name: 'Add condition'})
    );
    const dialog = await screen.findByRole('dialog');
    const fieldInput = within(dialog).getByTestId('field-input');
    const input = within(fieldInput).getByRole('combobox') as HTMLInputElement;
    act(() => {
      input.focus();
      fireEvent.keyDown(input, {key: 'ArrowDown'});
    });
    const fieldOptions = screen
      .getAllByRole('option')
      .map(o => o.textContent ?? '');
    expect(fieldOptions.some(label => label.includes('Hazards'))).toBe(true);
    expect(fieldOptions.some(label => label.includes('Notes'))).toBe(true);
    fireEvent.click(screen.getByRole('option', {name: /Notes/}));
    const valueInput = within(dialog)
      .getByTestId('value-input')
      .querySelector('input');
    expect(valueInput).not.toBeNull();
    fireEvent.change(valueInput as HTMLInputElement, {
      target: {value: 'ok'},
    });
    await user.click(
      within(dialog).getByRole('button', {name: 'Save Changes'})
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
      const asbestos = getOptions(store, HAZARDS).find(
        option => option.value === 'Asbestos'
      );
      expect(asbestos?.condition).toEqual({
        operator: 'equal',
        field: NOTES,
        value: 'ok',
      });
    });

    const updateButton = within(optionRow('Asbestos')).getByRole('button', {
      name: 'Update condition',
    });
    expect(updateButton.getAttribute('aria-pressed')).toBe('true');

    const snapshot = JSON.parse(
      JSON.stringify(store.getState().notebook.uiSpec.present)
    );
    store.dispatch(loaded(snapshot));
    expect(
      getOptions(store, HAZARDS).find(option => option.value === 'Asbestos')
        ?.condition
    ).toEqual({
      operator: 'equal',
      field: NOTES,
      value: 'ok',
    });
  });

  it('clears an option condition by deleting the property', async () => {
    const store = storeWithChoiceFields({optionCondition: true});
    const user = userEvent.setup();
    render(
      <WithProviders store={store}>
        <OptionsEditor fieldName={HAZARDS} />
      </WithProviders>
    );

    await user.click(
      within(optionRow('Asbestos')).getByRole('button', {
        name: 'Update condition',
      })
    );
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByTestId('delete-button'));
    await user.click(
      within(dialog).getByRole('button', {name: 'Save Changes'})
    );

    await waitFor(() => {
      const asbestos = getOptions(store, HAZARDS).find(
        option => option.value === 'Asbestos'
      );
      expect(asbestos).not.toHaveProperty('condition');
    });
  });

  it('keeps condition across reorder, rename, and Exclusive toggle', async () => {
    const store = storeWithChoiceFields({optionCondition: true});
    const user = userEvent.setup();
    render(
      <WithProviders store={store}>
        <OptionsEditor fieldName={HAZARDS} showExclusiveOptions />
      </WithProviders>
    );

    await user.click(optionIconButton('Asbestos', 'ArrowDropUpRoundedIcon'));

    expect(
      getOptions(store, HAZARDS).find(option => option.value === 'Asbestos')
        ?.condition
    ).toEqual(INDUSTRIAL_CONDITION);

    const exclusive = within(optionRow('Asbestos')).getByRole('checkbox');
    await user.click(exclusive);
    expect(
      getOptions(store, HAZARDS).find(option => option.value === 'Asbestos')
        ?.condition
    ).toEqual(INDUSTRIAL_CONDITION);

    await user.click(optionIconButton('Asbestos', 'EditIcon'));
    const dialog = await screen.findByRole('dialog');
    const textField = within(dialog).getByLabelText('Option Text');
    fireEvent.change(textField, {target: {value: 'Asbestos fibres'}});
    await user.click(within(dialog).getByRole('button', {name: 'Save'}));

    expect(
      getOptions(store, HAZARDS).find(
        option => option.value === 'Asbestos fibres'
      )?.condition
    ).toEqual(INDUSTRIAL_CONDITION);
  });

  it('rewrites field, section, and option conditions when an option value is renamed', async () => {
    const store = storeWithChoiceFields({optionCondition: true});
    const user = userEvent.setup();
    render(
      <WithProviders store={store}>
        <OptionsEditor fieldName={SITE_TYPE} />
      </WithProviders>
    );

    await user.click(optionIconButton('Industrial', 'EditIcon'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/used in/i)).toBeDefined();
    expect(within(dialog).getByText(/Field: Notes/)).toBeDefined();
    expect(within(dialog).getByText(/Section: Section A/)).toBeDefined();
    expect(
      within(dialog).getByText(/Option: Asbestos \(Field: Hazards\)/)
    ).toBeDefined();

    const textField = within(dialog).getByLabelText('Option Text');
    fireEvent.change(textField, {target: {value: 'Factory'}});
    await user.click(within(dialog).getByRole('button', {name: 'Save'}));

    await waitFor(() => {
      expect(
        store.getState().notebook.uiSpec.present.fields[NOTES].condition
      ).toEqual({operator: 'equal', field: SITE_TYPE, value: 'Factory'});
      expect(
        store.getState().notebook.uiSpec.present.views.sectionA.condition
      ).toEqual({operator: 'equal', field: SITE_TYPE, value: 'Factory'});
      expect(
        getOptions(store, HAZARDS).find(option => option.value === 'Asbestos')
          ?.condition
      ).toEqual({operator: 'equal', field: SITE_TYPE, value: 'Factory'});
    });
  });

  it('renders the compact control on a RadioGroup as well', () => {
    const store = storeWithChoiceFields();
    render(
      <WithProviders store={store}>
        <OptionsEditor fieldName={SITE_TYPE} showExpandedChecklist />
      </WithProviders>
    );
    expect(
      within(optionRow('Industrial')).getByRole('button', {
        name: 'Add condition',
      })
    ).toBeDefined();
    expect(
      within(optionRow('Industrial')).queryByText('Add condition')
    ).toBeNull();
  });
});
