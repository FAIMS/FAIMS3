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
 * @file Smoke tests for {@link InfoPanel} with Redux + theme providers.
 */

import {afterEach, describe, expect, test} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import {InfoPanel} from './info-panel';
import {registerSettingsSection} from '../features/design/settings-section-registry';

import {createDesignerStore} from '../createDesignerStore';
import {Provider} from 'react-redux';
import {ThemeProvider} from '@mui/material/styles';
import globalTheme from '../theme/index';
import {ReactNode} from 'react';
import {ToolkitStore} from '@reduxjs/toolkit/dist/configureStore';
import {AppState} from '../state/initial';

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

describe('Info Panel', () => {
  let unregisterSection: (() => void) | undefined;

  afterEach(() => {
    unregisterSection?.();
    unregisterSection = undefined;
  });

  test('render the info panel', () => {
    const store = createDesignerStore();
    render(
      <WithProviders store={store}>
        <InfoPanel />
      </WithProviders>
    );

    expect(screen.getByText('Design information')).toBeDefined();
    //const name = screen.getByTestId('name').querySelector('input');
    // TODO: this is unreliable - fails on first run but passes on repeat...
    // if (name) {
    //   fireEvent.change(name, {target: {value: 'Different Name'}});
    //   expect(store.getState().notebook.metadata.name).toBe('Different Name');
    // }
    // check some content
    screen.getByText('Enable QR code search of records');
    // TODO: fix this test
    // // try adding some metadata
    // act(() => {
    //   const metaName = screen.getByLabelText('Metadata Field Name');
    //   const metaValue = screen.getByLabelText('Metadata Field Value');
    //   fireEvent.change(metaName, {target: {value: 'Bob'}});
    //   fireEvent.change(metaValue, {target: {value: 'Bobalooba'}});
    //   const createButton = screen.getByText('Create New Field');
    //   createButton.click();
    //   expect(store.getState().notebook.metadata.Bob).toBe('Bobalooba');
    // });
    // // after that, the new metadata field should be visible
    // expect(screen.getByTestId('extra-field-Bob')).toBeDefined();
  });

  test('renders a registered settings section and saves what it changes', () => {
    unregisterSection = registerSettingsSection(
      'test-module',
      ({settings, onChange}) => (
        <button onClick={() => onChange({'test-module/flag': true})}>
          {`flag is ${settings['test-module/flag'] ?? 'unset'}`}
        </button>
      )
    );

    const store = createDesignerStore();
    render(
      <WithProviders store={store}>
        <InfoPanel />
      </WithProviders>
    );

    fireEvent.click(screen.getByText('flag is unset'));

    expect(
      store.getState().notebook.uiSpec.present.settings['test-module/flag']
    ).toBe(true);
    screen.getByText('flag is true');
  });
});
