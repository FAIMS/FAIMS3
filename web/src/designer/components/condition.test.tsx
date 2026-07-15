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

import {
  isBooleanCondition,
  normaliseConditionForCompare,
} from '@/lib/conditionUtils';
import {migrateNotebook} from '@faims3/data-model';
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
import {ReactNode} from 'react';
import {Provider} from 'react-redux';
import {describe, expect, test, vi} from 'vitest';
import {createDesignerStore} from '../createDesignerStore';
import {AppState, NotebookUISpec} from '../state/initial';
import {loaded} from '../store/slices/uiSpec';
import {sampleNotebook} from '../test-notebook';
import globalTheme from '../theme/index';
import {ConditionType} from '../types/condition';
import {ConditionControl} from './condition/ConditionControl';

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
    const condition: ConditionType = {
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
    expect(optionLabels.some(label => label.includes('ID'))).toBe(true);
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
    expect(optionLabels.some(label => label.includes('ID'))).toBe(true);
    // The field that lives in another form must NOT be offered.
    expect(optionLabels).not.toContain('Cross Form Widget');
  });

  test('wraps a field condition with a new empty condition row', () => {
    const store = createDesignerStore();
    const {migrated: notebook} = migrateNotebook(sampleNotebook);
    store.dispatch(loaded(notebook.uiSpec as NotebookUISpec));

    const condition: ConditionType = {
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

    expect(screen.getAllByTestId('field-input')).toHaveLength(1);

    fireEvent.click(screen.getByTestId('split-button'));

    // The existing rule is now grouped with a new empty rule.
    expect(screen.getAllByTestId('field-input')).toHaveLength(2);

    expect(onChangeFn).toHaveBeenCalled();

    const updatedCondition = onChangeFn.mock
      .lastCall?.[0] as ConditionType | null;

    // The UI will still show the empty row, so it will still have two rows
    expect(screen.getAllByTestId('field-input')).toHaveLength(2);

    // But the empty rule is excluded from the normalised condition.
    expect(
      normaliseConditionForCompare(updatedCondition ?? null)
    ).toStrictEqual(normaliseConditionForCompare(condition));
  });

  test('creates a boolean condition group after completing the new rule', async () => {
    const store = createDesignerStore();
    const {migrated: notebook} = migrateNotebook(sampleNotebook);
    store.dispatch(loaded(notebook.uiSpec as NotebookUISpec));

    const condition: ConditionType = {
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

    // Wrap the existing rule in a group with a new empty rule.
    fireEvent.click(screen.getByTestId('split-button'));
    expect(screen.getAllByTestId('field-input')).toHaveLength(2);

    // Get the field picker for the new rule.
    const secondFieldInput = within(
      screen.getAllByTestId('field-input')[1]
    ).getByRole('combobox');

    // Search for a field to use in the new rule.
    fireEvent.change(secondFieldInput, {
      target: {value: 'Sample Location'},
    });

    // Select the matching field from the Autocomplete options.
    const option = await screen.findByRole('option', {
      name: /sample location/i,
    });
    fireEvent.click(option);

    // Wait for the value input for the new rule to be rendered.
    await waitFor(() => {
      expect(screen.getAllByTestId('value-input')).toHaveLength(2);
    });

    const secondValueInput = screen
      .getAllByTestId('value-input')[1]
      .querySelector('input');

    if (!secondValueInput) {
      throw new Error('Expected the second rule to have a value input');
    }

    // Ignore changes emitted while creating and selecting the new rule.
    onChangeFn.mockClear();

    // Complete the new rule.
    fireEvent.change(secondValueInput, {
      target: {value: '200'},
    });

    // Check the completed rules are saved as an AND condition.
    await waitFor(() => {
      const updatedCondition = onChangeFn.mock
        .lastCall?.[0] as ConditionType | null;

      expect(updatedCondition).toBeDefined();
      expect(updatedCondition).not.toBeNull();

      // Narrow the type for the remaining assertions.
      if (!updatedCondition || !isBooleanCondition(updatedCondition)) {
        throw new Error(
          'Expected the completed rules to produce a boolean condition'
        );
      }

      expect(isBooleanCondition(updatedCondition)).toBe(true);

      expect(updatedCondition.operator).toBe('and');
      expect(updatedCondition.conditions).toHaveLength(2);

      // Normalises conditions to the same key order before comparison.
      expect(
        normaliseConditionForCompare(updatedCondition.conditions?.[0] ?? null)
      ).toStrictEqual(normaliseConditionForCompare(condition));
      expect(
        normaliseConditionForCompare(updatedCondition.conditions?.[1] ?? null)
      ).toStrictEqual(
        normaliseConditionForCompare({
          operator: 'equal',
          field: 'Sample-Location',
          value: '200',
        })
      );
    });
  });

  test('deletes a rule and keeps the remaining condition', async () => {
    const store = createDesignerStore();
    const {migrated: notebook} = migrateNotebook(sampleNotebook);
    store.dispatch(loaded(notebook.uiSpec as NotebookUISpec));

    const remainingCondition: ConditionType = {
      operator: 'equal',
      field: 'Sample-Location',
      value: 100,
    };

    const deletedCondition: ConditionType = {
      operator: 'equal',
      field: 'Sample-Location',
      value: 200,
    };

    const initialCondition: ConditionType = {
      operator: 'and',
      conditions: [remainingCondition, deletedCondition],
    };

    const onChangeFn = vi.fn();

    render(
      <WithProviders store={store}>
        <ConditionControl initial={initialCondition} onChange={onChangeFn} />
      </WithProviders>
    );

    // Both initial rules are rendered.
    expect(screen.getAllByTestId('field-input')).toHaveLength(2);
    expect(screen.getAllByTestId('delete-button')).toHaveLength(2);

    // Check the initial condition keeps its boolean shape.
    const renderedCondition = onChangeFn.mock
      .lastCall?.[0] as ConditionType | null;

    if (!renderedCondition || !isBooleanCondition(renderedCondition)) {
      throw new Error(
        'Expected the initial condition to be a boolean condition'
      );
    }

    expect(renderedCondition.conditions).toHaveLength(2);
    expect(renderedCondition.conditions?.[0]).toStrictEqual(remainingCondition);
    expect(renderedCondition.conditions?.[1]).toStrictEqual(deletedCondition);

    // Ignore the change emitted from the initial render.
    onChangeFn.mockClear();

    // Delete the second rule.
    fireEvent.click(screen.getAllByTestId('delete-button')[1]);

    // Only the first rule remains in the editor.
    expect(screen.getAllByTestId('field-input')).toHaveLength(1);

    await waitFor(() => {
      const updatedCondition = onChangeFn.mock
        .lastCall?.[0] as ConditionType | null;
      if (!updatedCondition) {
        throw new Error('Expected the remaining condition to exist');
      }

      // The one-rule group is normalised to the remaining rule.
      expect(isBooleanCondition(updatedCondition)).toBe(false);
      // Normalises conditions to the same key order before comparison.
      expect(normaliseConditionForCompare(updatedCondition)).toStrictEqual(
        normaliseConditionForCompare(remainingCondition)
      );
    });
  });
});
