// Copyright 2023 FAIMS Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @file Interaction tests for the List of Records plan dialog: its field picker
 * and the label every plan must carry.
 */

import {LIST_OF_RECORDS_PLAN_TYPE, migrateNotebook} from '@faims3/data-model';
import {ThemeProvider} from '@mui/material/styles';
import {ToolkitStore} from '@reduxjs/toolkit/dist/configureStore';
import {fireEvent, render, screen, within} from '@testing-library/react';
import {ReactNode} from 'react';
import {Provider} from 'react-redux';
import {describe, expect, test, vi} from 'vitest';
import {createDesignerStore} from '../../createDesignerStore';
import {AppState, NotebookUISpec} from '../../state/initial';
import {loaded} from '../../store/slices/uiSpec';
import {sampleNotebook} from '../../test-notebook';
import globalTheme from '../../theme/index';
import {ListOfRecordsPlanDialog} from './ListOfRecordsPlanDialog';

const WithProviders = ({
  children,
  store,
}: {
  children: ReactNode;
  store: ToolkitStore<AppState>;
}) => (
  <ThemeProvider theme={globalTheme}>
    <Provider store={store}>{children}</Provider>
  </ThemeProvider>
);

/** Render the dialog editing a plan on the sample notebook's one form. */
const renderDialog = (recordFields: string[], label = 'Lab samples') => {
  const store = createDesignerStore();
  const {migrated: notebook} = migrateNotebook(sampleNotebook);
  store.dispatch(loaded(notebook.uiSpec as NotebookUISpec));
  const onSave = vi.fn();

  render(
    <WithProviders store={store}>
      <ListOfRecordsPlanDialog
        open
        uiSpec={store.getState().notebook.uiSpec.present}
        initialTemplate={{
          planId: LIST_OF_RECORDS_PLAN_TYPE,
          planType: LIST_OF_RECORDS_PLAN_TYPE,
          label,
          formType: 'Primary',
          recordFields,
        }}
        onClose={vi.fn()}
        onSave={onSave}
      />
    </WithProviders>
  );

  return {onSave};
};

/** Labels of the chips standing for the chosen fields, in order. */
const chosenFieldLabels = (): string[] =>
  [...document.querySelectorAll('.MuiChip-label')].map(
    chip => chip.textContent ?? ''
  );

/** The chip standing for one chosen field. */
const chipFor = (label: string): HTMLElement => {
  const chip = screen.getByText(label).closest('.MuiChip-root');
  if (!chip) throw new Error(`No chip for ${label}`);
  return chip as HTMLElement;
};

describe('ListOfRecordsPlanDialog', () => {
  test('searching for a field adds it to the chosen list', async () => {
    const {onSave} = renderDialog(['Identifier']);

    // The already-chosen field shows underneath the picker
    expect(chipFor('Identifier')).toBeDefined();

    const input = within(screen.getByTestId('list-plan-field-add')).getByRole(
      'combobox'
    );
    fireEvent.change(input, {target: {value: 'photograph'}});
    fireEvent.click(await screen.findByRole('option', {name: /photograph/i}));

    expect(chipFor('Sample Photograph')).toBeDefined();

    fireEvent.click(screen.getByRole('button', {name: 'Save Plan'}));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        formType: 'Primary',
        recordFields: ['Identifier', 'Sample-Photograph'],
      })
    );
  });

  test('a chosen field can be removed and is offered again', async () => {
    const {onSave} = renderDialog(['Identifier', 'Sample-Photograph']);

    const input = within(screen.getByTestId('list-plan-field-add')).getByRole(
      'combobox'
    );
    fireEvent.change(input, {target: {value: 'identifier'}});
    // Chosen fields are excluded from the picker, so this search finds nothing
    expect(await screen.findByText('No fields left to add')).toBeDefined();

    fireEvent.click(within(chipFor('Identifier')).getByTestId('CancelIcon'));
    expect(chosenFieldLabels()).toEqual(['Sample Photograph']);
    // Removing it puts it back in the picker
    expect(
      await screen.findByRole('option', {name: /identifier/i})
    ).toBeDefined();

    fireEvent.click(screen.getByRole('button', {name: 'Save Plan'}));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({recordFields: ['Sample-Photograph']})
    );
  });

  test('will not save a plan with no label to show on the chooser', () => {
    const {onSave} = renderDialog(['Identifier'], '');

    const save = screen.getByRole('button', {name: 'Save Plan'});
    expect(save).toHaveProperty('disabled', true);

    fireEvent.change(screen.getByTestId('plan-label'), {
      target: {value: 'Lab samples'},
    });
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({label: 'Lab samples'})
    );
  });

  test('a field since deleted from the form is still shown, to be removed', () => {
    const {onSave} = renderDialog(['Gone-Field', 'Identifier']);

    expect(chosenFieldLabels()).toEqual(['Gone-Field', 'Identifier']);

    fireEvent.click(within(chipFor('Gone-Field')).getByTestId('CancelIcon'));

    fireEvent.click(screen.getByRole('button', {name: 'Save Plan'}));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({recordFields: ['Identifier']})
    );
  });
});
