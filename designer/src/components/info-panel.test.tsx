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

import { describe, expect, test } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { InfoPanel } from './info-panel';

import { store } from '../state/store';
import { Provider } from 'react-redux';
import { ThemeProvider } from "@mui/material/styles";
import globalTheme from "../theme/index";
import { ReactNode } from 'react';

const WithProviders = ({children}: {children: ReactNode}) => (
    <ThemeProvider theme={globalTheme}>
        <Provider store={store}>
            {children}
        </Provider>
    </ThemeProvider>
    );

describe('Info Panel',  () => {
    test('render the info panel', () => { 

        render (
            <WithProviders>
                <InfoPanel/>
            </WithProviders>
        )

        expect(screen.getByText('General Information')).toBeDefined();
        const name = screen.getByTestId('name').querySelector('input');
        if (name) {
            fireEvent.change(name, { target: { value: 'New Name' } });
            expect(store.getState().metadata.name).toBe('New Name');
        }
        // check some content
        screen.getByText('Enable QR Code Search of Records');
        // try adding some metadata
        act(() => {
            const metaName = screen.getByLabelText('Metadata Field Name');
            const metaValue = screen.getByLabelText('Metadata Field Value');
            fireEvent.change(metaName, { target: { value: 'Bob' } });
            fireEvent.change(metaValue, { target: { value: 'Bobalooba' } });
            const createButton = screen.getByText('Create New Field');
            createButton.click();
            expect(store.getState().metadata.Bob).toBe('Bobalooba');
        });
        // after that, the new metadata field should be visible
        expect(screen.getByTestId('extra-field-Bob')).toBeDefined();
    })
})