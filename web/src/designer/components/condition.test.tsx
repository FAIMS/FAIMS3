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
 * @file Interaction tests for {@link ConditionControl} against a hydrated store.
 */

import {vi, describe, expect, test} from 'vitest';
import {act, fireEvent, render, screen, within} from '@testing-library/react';
import {ConditionControl} from './condition/ConditionControl';
import {ConditionType} from '../types/condition';
import {sampleNotebook} from '../test-notebook';
import {createDesignerStore} from '../createDesignerStore';
import {Provider} from 'react-redux';
import {ThemeProvider} from '@mui/material/styles';
import globalTheme from '../theme/index';
import {ReactNode} from 'react';
import {migrateNotebook} from '@faims3/data-model';
import {ToolkitStore} from '@reduxjs/toolkit/dist/configureStore';
import {AppState, NotebookUISpec} from '../state/initial';
import {loaded} from '../store/slices/uiSpec';

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

describe('ConditionControl', () => {
  test('render and interact with a field condition', () => {
    const store = createDesignerStore();
    const {migrated: notebook} = migrateNotebook(sampleNotebook);
    store.dispatch(loaded(notebook.uiSpec as NotebookUISpec));
    const condition = {
      operator: 'equal',
      field: 'New-Text-Field',
      value: 'test',
    };

    const onChangeFn = vi.fn();
    render(
      <WithProviders store={store}>
        <ConditionControl initial={condition} onChange={onChangeFn} />
      </WithProviders>
    );

    expect(screen.getByTestId('field-input')).toBeDefined();
    expect(screen.getByTestId('operator-input')).toBeDefined();
    expect(screen.getByTestId('value-input')).toBeDefined();

    act(() => {
      const fieldInput = screen
        .getByTestId('field-input')
        .querySelector('input');
      const opInput = screen
        .getByTestId('operator-input')
        .querySelector('input');
      const valueInput = screen
        .getByTestId('value-input')
        .querySelector('input');
      if (fieldInput !== null && valueInput !== null && opInput !== null) {
        fireEvent.change(valueInput, {target: {value: 'Bobalooba'}});
        expect(onChangeFn.mock.lastCall).toStrictEqual([
          {
            field: 'New-Text-Field',
            operator: 'equal',
            value: 'Bobalooba',
          },
        ]);
        fireEvent.change(opInput, {target: {value: 'not-equal'}});
        expect(onChangeFn.mock.lastCall).toStrictEqual([
          {
            field: 'New-Text-Field',
            operator: 'not-equal',
            value: 'Bobalooba',
          },
        ]);
      }
    });
  });

  test('field condition omits field in select', () => {
    const store = createDesignerStore();
    const {migrated: notebook} = migrateNotebook(sampleNotebook);
    store.dispatch(loaded(notebook.uiSpec as NotebookUISpec));

    const theField = 'New-Text-Field';
    const onChangeFn = vi.fn();
    render(
      <WithProviders store={store}>
        <ConditionControl onChange={onChangeFn} field={theField} />
      </WithProviders>
    );
    const select = screen.getByTestId('field-input');
    expect(select).toBeDefined();
    const opInput = screen.getByTestId('operator-input').querySelector('input');
    expect(opInput?.value).toBe('');

    // would like to check for the options but they are not easy to find
    // since they don't render until the option button is clicked
    // this didn't work...
    // fireEvent.mouseDown(select);

    // // select should not have the target field as an option
    // expect(document.querySelector(`[data-value="${theField}"]`)).toBeNull();
    // // but another field is there
    // expect(document.querySelector('[data-value="Sample-Location"]')).not.toBeNull();
  });

  test('field condition omits all view fields in select', () => {
    const store = createDesignerStore();
    const {migrated: notebook} = migrateNotebook(sampleNotebook);
    store.dispatch(loaded(notebook.uiSpec as NotebookUISpec));

    const theView = 'Primary-New-Section';
    const onChangeFn = vi.fn();
    render(
      <WithProviders store={store}>
        <ConditionControl onChange={onChangeFn} view={theView} />
      </WithProviders>
    );

    const select = screen.getByTestId('field-input');
    expect(select).toBeDefined();
    const opInput = screen.getByTestId('operator-input').querySelector('input');
    expect(opInput?.value).toBe('');

    // would like to check for the options but they are not easy to find
    // since they don't render until the option button is clicked
    // this didn't work...
    // fireEvent.mouseDown(select);
    // // select should not have fields in the target view as an option
    // sampleNotebook.uiSpec.views[theView].fields.map((field) => {
    //   expect(document.querySelector(`[data-value='${field}']`)).toBeNull();
    // });
    // // but another field is there
    // expect(document.querySelector(`[data-value="Field ID"]`)).not.toBeNull();
  });

  /**
   * Builds a store from the sample notebook plus a second form ("Secondary")
   * containing a single field, so cross-form scoping of the field picker can be
   * exercised. Returns the hydrated store.
   */
  const storeWithSecondForm = () => {
    const store = createDesignerStore();
    const {migrated: notebook} = migrateNotebook(
      JSON.parse(JSON.stringify(sampleNotebook))
    );
    const uiSpec = notebook.uiSpec as NotebookUISpec;

    // A field that lives only in the second form.
    uiSpec.fields['Cross-Form-Field'] = {
      ...uiSpec.fields['New-Text-Field'],
      'component-parameters': {
        ...uiSpec.fields['New-Text-Field']['component-parameters'],
        label: 'Cross Form Widget',
        name: 'Cross-Form-Field',
      },
    };
    uiSpec.views['Secondary-Section'] = {
      label: 'Secondary Detail',
      fields: ['Cross-Form-Field'],
    };
    uiSpec.viewsets['Secondary'] = {
      label: 'Secondary Form',
      views: ['Secondary-Section'],
    };
    uiSpec.visible_types.push('Secondary');

    store.dispatch(loaded(uiSpec));
    return store;
  };

  /** Opens the field-picker Autocomplete and returns the rendered option labels. */
  const openFieldOptions = (): string[] => {
    const input = within(screen.getByTestId('field-input')).getByRole(
      'combobox'
    ) as HTMLInputElement;
    act(() => {
      input.focus();
      fireEvent.keyDown(input, {key: 'ArrowDown'});
    });
    return screen
      .getAllByRole('option')
      .map(o => o.textContent ?? '')
      .filter(Boolean);
  };

  test('field condition picker excludes fields from other forms', () => {
    const store = storeWithSecondForm();
    const onChangeFn = vi.fn();
    render(
      <WithProviders store={store}>
        {/* New-Text-Field belongs to the "Primary" form */}
        <ConditionControl onChange={onChangeFn} field={'New-Text-Field'} />
      </WithProviders>
    );

    const optionLabels = openFieldOptions();

    // A same-form field (different section) is still offered.
    expect(optionLabels).toContain('ID');
    // The field that lives in another form must NOT be offered.
    expect(optionLabels).not.toContain('Cross Form Widget');
  });

  test('section condition picker excludes fields from other forms', () => {
    const store = storeWithSecondForm();
    const onChangeFn = vi.fn();
    render(
      <WithProviders store={store}>
        {/* Primary-New-Section belongs to the "Primary" form */}
        <ConditionControl onChange={onChangeFn} view={'Primary-New-Section'} />
      </WithProviders>
    );

    const optionLabels = openFieldOptions();

    // A field from another section of the same form is still offered.
    expect(optionLabels).toContain('ID');
    // The field that lives in another form must NOT be offered.
    expect(optionLabels).not.toContain('Cross Form Widget');
  });

  test('make a boolean condition from a field', () => {
    const store = createDesignerStore();
    const {migrated: notebook} = migrateNotebook(sampleNotebook);
    store.dispatch(loaded(notebook.uiSpec as NotebookUISpec));

    const condition = {
      operator: 'equal',
      field: 'Sample-Location',
      value: 100,
    };

    const onChangeFn = vi.fn();
    render(
      <WithProviders store={store}>
        <ConditionControl initial={condition} onChange={onChangeFn} />
      </WithProviders>
    );

    act(() => {
      const splitButton = screen.getByTestId('split-button');
      if (splitButton) {
        fireEvent.click(splitButton);
        expect(onChangeFn).toHaveBeenCalled();
        const last = onChangeFn.mock.lastCall as ConditionType[];
        expect(last[0].operator).toBe('and');
        expect(last[0].conditions?.length).toBe(2);
      }
    });
  });
});
