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
 * @file Visibility tests for PlanTemplateManager: feature flag hides Add
 * Plan when a template has no existing plan, but leaves existing plans
 * editable.
 */

import {COUNTED_PLAN_TYPE} from '@faims3/data-model';
import {ThemeProvider} from '@mui/material/styles';
import {ToolkitStore} from '@reduxjs/toolkit/dist/configureStore';
import {render, screen} from '@testing-library/react';
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

const countedTemplate = {planType: COUNTED_PLAN_TYPE, formType: 'FORM1'};

const renderManager = (
  mode: AppState['mode'],
  planTemplates: AppState['notebook']['planTemplates']
) => {
  const store = createDesignerStore(
    {...initialState.notebook, planTemplates},
    false,
    mode
  );
  return render(
    <WithProviders store={store}>
      <PlanTemplateManager />
    </WithProviders>
  );
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
});
