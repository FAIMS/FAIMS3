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
 * @file Tests for PlanTemplateManager: the feature flag hides Add Plan when a
 * template has no existing plan but leaves existing plans editable, and the
 * rows order, label and remove a plan by its position.
 */

import {COUNTED_PLAN_TYPE} from '@faims3/data-model';
import {ThemeProvider} from '@mui/material/styles';
import {ToolkitStore} from '@reduxjs/toolkit/dist/configureStore';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {ReactNode} from 'react';
import {Provider} from 'react-redux';
import {beforeEach, describe, expect, test, vi} from 'vitest';
import {createDesignerStore} from '../../createDesignerStore';
import {AppState, initialState} from '../../state/initial';
import globalTheme from '../../theme/index';
import {PlanTemplateManager} from './PlanTemplateManager';

const {designerConfig} = vi.hoisted(() => ({
  designerConfig: {enablePlansInDesigner: true, templateProtections: false},
}));

vi.mock('../../buildconfig', () => ({
  config: designerConfig,
}));

// Branding only; the real module drags in the whole app config
vi.mock('@/constants', () => ({
  config: {notebookName: 'notebook', notebookNamePlural: 'notebooks'},
}));

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

const countedTemplate = {
  planId: COUNTED_PLAN_TYPE,
  planType: COUNTED_PLAN_TYPE,
  formType: 'FORM1',
};

const secondTemplate = {
  planId: `${COUNTED_PLAN_TYPE}.1`,
  planType: COUNTED_PLAN_TYPE,
  formType: 'FORM1',
};

/** Each row's Label field holds its plan id as placeholder, so the ids read the order. */
const renderedOrder = () =>
  screen
    .getAllByRole('textbox')
    .map(field => field.getAttribute('placeholder'));

const renderManager = (
  mode: AppState['mode'],
  planTemplates: AppState['notebook']['planTemplates']
) => {
  const store = createDesignerStore(
    {...initialState.notebook, planTemplates},
    false,
    mode
  );
  return {
    store,
    ...render(
      <WithProviders store={store}>
        <PlanTemplateManager />
      </WithProviders>
    ),
  };
};

describe('PlanTemplateManager feature flag', () => {
  beforeEach(() => {
    designerConfig.enablePlansInDesigner = true;
  });

  test('shows Add Plan in template mode when the flag is on and there is no plan', () => {
    renderManager('template', []);
    expect(screen.getByTestId('web-designer-add-plan-button')).toBeDefined();
  });

  test('hides Add Plan in template mode when the flag is off and there is no plan', () => {
    designerConfig.enablePlansInDesigner = false;
    const {container} = renderManager('template', []);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('web-designer-add-plan-button')).toBeNull();
  });

  test('keeps existing plan controls when the flag is off', () => {
    designerConfig.enablePlansInDesigner = false;
    renderManager('template', [countedTemplate]);
    expect(screen.getByLabelText('edit plan')).toBeDefined();
    expect(screen.getByText(/Counted plan/)).toBeDefined();
    expect(screen.queryByTestId('web-designer-add-plan-button')).toBeNull();
  });

  test('hides the manager outside template mode even when the flag is on', () => {
    const {container} = renderManager('project', [countedTemplate]);
    expect(container.firstChild).toBeNull();
  });

  test('keeps Add Plan offered once the template carries a plan', () => {
    renderManager('template', [countedTemplate]);
    expect(screen.getByTestId('web-designer-add-plan-button')).toBeDefined();
  });
});

describe('PlanTemplateManager rows', () => {
  beforeEach(() => {
    designerConfig.enablePlansInDesigner = true;
  });

  test('moves a plan by its position', () => {
    const {store} = renderManager('template', [
      countedTemplate,
      secondTemplate,
    ]);
    expect(renderedOrder()).toEqual([
      countedTemplate.planId,
      secondTemplate.planId,
    ]);

    fireEvent.click(screen.getAllByLabelText('move plan down')[0]);

    expect(store.getState().notebook.planTemplates.map(p => p.planId)).toEqual([
      secondTemplate.planId,
      countedTemplate.planId,
    ]);
    expect(renderedOrder()).toEqual([
      secondTemplate.planId,
      countedTemplate.planId,
    ]);
  });

  test('leaves the ends of the list nowhere to move', () => {
    renderManager('template', [countedTemplate, secondTemplate]);
    expect(screen.getAllByLabelText('move plan up')[0]).toHaveProperty(
      'disabled',
      true
    );
    expect(screen.getAllByLabelText('move plan down')[1]).toHaveProperty(
      'disabled',
      true
    );
  });

  test('labels the plan the row belongs to', () => {
    const {store} = renderManager('template', [
      countedTemplate,
      secondTemplate,
    ]);

    fireEvent.change(screen.getAllByRole('textbox')[1], {
      target: {value: 'Lab'},
    });

    expect(store.getState().notebook.planTemplates.map(p => p.label)).toEqual([
      undefined,
      'Lab',
    ]);
  });

  test('removes the plan the row belongs to, once confirmed', async () => {
    const {store} = renderManager('template', [
      countedTemplate,
      secondTemplate,
    ]);

    fireEvent.click(screen.getAllByLabelText('remove plan')[1]);
    fireEvent.click(screen.getByRole('button', {name: 'Remove'}));

    expect(store.getState().notebook.planTemplates.map(p => p.planId)).toEqual([
      countedTemplate.planId,
    ]);
    // The confirmation hides the rows from the accessibility tree until it closes
    await waitFor(() =>
      expect(renderedOrder()).toEqual([countedTemplate.planId])
    );
  });
});
