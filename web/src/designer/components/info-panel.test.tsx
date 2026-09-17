// SPDX-License-Identifier: Apache-2.0

/**
 * @file Smoke tests for {@link InfoPanel} with Redux + theme providers.
 */

import {describe, expect, test} from 'vitest';
import {render, screen} from '@testing-library/react';
import {InfoPanel} from './info-panel';

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
    screen.getByText('Plan chooser text');
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
});
