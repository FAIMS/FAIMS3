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
 * @file Interaction tests for the List of Forms plan dialog: its form picker
 * and the label every plan dialog authors.
 */

import {LIST_OF_FORMS_PLAN_TYPE} from '@faims3/data-model';
import {ThemeProvider} from '@mui/material/styles';
import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, test, vi} from 'vitest';
import globalTheme from '../../theme/index';
import {ListOfFormsPlanDialog} from './ListOfFormsPlanDialog';

// Two forms, so the saved order can be checked against the declared one
const uiSpec = {
  viewsets: {
    Calibration: {label: 'Calibration', views: []},
    Instrument: {label: 'Instrument', views: []},
  },
  views: {},
  fields: {},
};

/** Render the dialog editing a plan naming the given forms. */
const renderDialog = (
  formTypes: string[],
  label = 'Equipment',
  takenLabels: string[] = []
) => {
  const onSave = vi.fn();

  render(
    <ThemeProvider theme={globalTheme}>
      <ListOfFormsPlanDialog
        open
        uiSpec={uiSpec}
        initialTemplate={{
          planId: LIST_OF_FORMS_PLAN_TYPE,
          planType: LIST_OF_FORMS_PLAN_TYPE,
          label,
          formTypes,
        }}
        takenLabels={takenLabels}
        onClose={vi.fn()}
        onSave={onSave}
      />
    </ThemeProvider>
  );

  return {onSave};
};

const saveButton = () => screen.getByRole('button', {name: 'Save Plan'});

describe('ListOfFormsPlanDialog', () => {
  test('ticks the forms the template names and saves them in declared order', () => {
    const {onSave} = renderDialog(['Instrument']);

    expect(screen.getByLabelText('Instrument')).toHaveProperty('checked', true);
    expect(screen.getByLabelText('Calibration')).toHaveProperty(
      'checked',
      false
    );

    fireEvent.click(screen.getByLabelText('Calibration'));
    fireEvent.click(saveButton());
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        planType: LIST_OF_FORMS_PLAN_TYPE,
        formTypes: ['Calibration', 'Instrument'],
      })
    );
  });

  test('will not save a plan naming no forms', () => {
    const {onSave} = renderDialog(['Calibration']);

    fireEvent.click(screen.getByLabelText('Calibration'));
    expect(saveButton()).toHaveProperty('disabled', true);
    expect(onSave).not.toHaveBeenCalled();
  });

  test('drops a form since deleted from the template, and says so', () => {
    const {onSave} = renderDialog(['Gone', 'Calibration']);

    expect(
      screen.getByText(/previously selected form no longer exists/)
    ).toBeDefined();

    fireEvent.click(saveButton());
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({formTypes: ['Calibration']})
    );
  });

  test('will not save a plan with no label to show on the chooser', () => {
    const {onSave} = renderDialog(['Calibration'], '');

    expect(saveButton()).toHaveProperty('disabled', true);

    fireEvent.change(screen.getByTestId('plan-label'), {
      target: {value: 'Equipment'},
    });
    fireEvent.click(saveButton());
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({label: 'Equipment'})
    );
  });

  test("will not save a plan reusing another plan's label", () => {
    const {onSave} = renderDialog(['Calibration'], 'Field survey', [
      'Field survey',
    ]);

    expect(saveButton()).toHaveProperty('disabled', true);
    expect(onSave).not.toHaveBeenCalled();
  });
});
