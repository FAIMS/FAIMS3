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
 * @file Interaction tests for the Map Collection plan dialog: its spatial
 * field, its pre-filled fields with their required/optional toggle, and the
 * label every plan dialog authors.
 */

import {
  MAP_COLLECTION_PLAN_TYPE,
  migrateNotebook,
  type MapCollectionRecordField,
} from '@faims3/data-model';
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
import {
  MapCollectionPlanDialog,
  spatialFieldKind,
} from './MapCollectionPlanDialog';

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
const renderDialog = ({
  recordFields = [],
  spatialFieldId = 'Sample-Location',
  label = 'Site visits',
}: {
  recordFields?: MapCollectionRecordField[];
  spatialFieldId?: string;
  label?: string;
} = {}) => {
  const store = createDesignerStore();
  const {migrated: notebook} = migrateNotebook(sampleNotebook);
  store.dispatch(loaded(notebook.uiSpec as NotebookUISpec));
  const onSave = vi.fn();

  render(
    <WithProviders store={store}>
      <MapCollectionPlanDialog
        open
        uiSpec={store.getState().notebook.uiSpec.present}
        initialTemplate={{
          planId: MAP_COLLECTION_PLAN_TYPE,
          planType: MAP_COLLECTION_PLAN_TYPE,
          label,
          formType: 'Primary',
          recordFields,
          spatialFieldId,
        }}
        takenLabels={[]}
        onClose={vi.fn()}
        onSave={onSave}
      />
    </WithProviders>
  );

  return {onSave};
};

describe('MapCollectionPlanDialog', () => {
  test('saves the spatial field and the chosen fields with their required flags', async () => {
    const {onSave} = renderDialog({
      recordFields: [{fieldId: 'Identifier', required: false}],
    });

    // The stored spatial field is shown with what it stores
    expect(screen.getByText(/Stores a GPS point/)).toBeDefined();

    const input = within(screen.getByTestId('map-plan-field-add')).getByRole(
      'combobox'
    );
    fireEvent.change(input, {target: {value: 'length'}});
    fireEvent.click(await screen.findByRole('option', {name: /length/i}));

    // Mark the first field required; the new one stays optional
    fireEvent.click(
      within(screen.getByTestId('map-plan-field-Identifier')).getByRole(
        'button',
        {name: /optional/i}
      )
    );

    fireEvent.click(screen.getByRole('button', {name: 'Save Plan'}));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        planType: MAP_COLLECTION_PLAN_TYPE,
        formType: 'Primary',
        spatialFieldId: 'Sample-Location',
        recordFields: [
          {fieldId: 'Identifier', required: true},
          {fieldId: 'Length-mm', required: false},
        ],
      })
    );
  });

  test('does not offer the spatial field or an unsupported field for pre-filling', async () => {
    renderDialog();

    const input = within(screen.getByTestId('map-plan-field-add')).getByRole(
      'combobox'
    );
    fireEvent.change(input, {target: {value: 'sample location'}});
    expect(await screen.findByText('No fields left to add')).toBeDefined();
    fireEvent.change(input, {target: {value: 'photograph'}});
    expect(await screen.findByText('No fields left to add')).toBeDefined();
  });

  test('will not save without a spatial field', () => {
    const {onSave} = renderDialog({spatialFieldId: ''});

    expect(screen.getByRole('button', {name: 'Save Plan'})).toHaveProperty(
      'disabled',
      true
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  test('a spatial field no longer spatial on the form is shown, to be removed', () => {
    const {onSave} = renderDialog({spatialFieldId: 'Identifier'});

    // Shown as a warning chip rather than silently dropped
    const chip = screen.getByText('Identifier').closest('.MuiChip-root');
    expect(chip).not.toBeNull();
    fireEvent.click(within(chip as HTMLElement).getByTestId('CancelIcon'));

    expect(screen.getByRole('button', {name: 'Save Plan'})).toHaveProperty(
      'disabled',
      true
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  test('will not save a plan with no label to show on the chooser', () => {
    const {onSave} = renderDialog({label: ''});

    const save = screen.getByRole('button', {name: 'Save Plan'});
    expect(save).toHaveProperty('disabled', true);

    fireEvent.change(screen.getByTestId('plan-label'), {
      target: {value: 'Site visits'},
    });
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({label: 'Site visits'})
    );
  });

  test('names what a spatial field stores', () => {
    expect(spatialFieldKind({'component-name': 'TakePoint'})).toBe('GPS point');
    expect(
      spatialFieldKind({
        'component-name': 'MapFormField',
        'component-parameters': {featureType: 'Polygon'},
      })
    ).toBe('Polygon');
    expect(spatialFieldKind({'component-name': 'MapFormField'})).toBe('Point');
  });
});
