/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: datagrid_toolbar.tsx
 * Description:
 *   File is creating custom tool bar instead of default GridToolbar to disable export button
 */

import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {AutoIncrementEditForm} from './edit-form';
import {expect, describe, it} from 'vitest';
import {StateProvider} from '../../../context/store';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

const props = {
  project_id: 'project-1',
  form_id: 'Sample-Form',
  field_id: 'Sample-Field',
  label: 'Sample Field',
  open: true,
  handleClose: () => {},
};

const queryClient = new QueryClient();

describe('Check edit-form component', () => {
  it('Check add btn creates range inputs', async () => {
    render(
      <StateProvider>
        <QueryClientProvider client={queryClient}>
          <AutoIncrementEditForm {...props} />
        </QueryClientProvider>
      </StateProvider>
    );

    const addRangeBtn = screen.getByTestId('addNewRangeBtn');

    // Initially, there should be no range inputs since we mocked empty ranges
    await waitFor(() => {
      expect(screen.queryByLabelText('Start')).not.toBeTruthy();
    });

    fireEvent.click(addRangeBtn);

    // After clicking add, there should be range inputs
    await waitFor(() => {
      expect(screen.getByLabelText('Start')).toBeTruthy();
      expect(screen.getByLabelText('Stop')).toBeTruthy();
    });
  });
  it('Check remove btn', async () => {
    render(
      <StateProvider>
        <QueryClientProvider client={queryClient}>
          <AutoIncrementEditForm {...props} />
        </QueryClientProvider>
      </StateProvider>
    );
    const addRangeBtn = screen.getByTestId('addNewRangeBtn');

    await waitFor(() => {
      expect(screen.getByLabelText('Start')).toBeTruthy();
      expect(screen.getByLabelText('Stop')).toBeTruthy();
    });

    // Add another range so we can remove one (remove is disabled when there's only one range)
    fireEvent.click(addRangeBtn);

    await waitFor(() => {
      expect(screen.getAllByLabelText('Start')).toHaveLength(2);
    });

    const removeRangeBtns = screen.getAllByTestId('removeRangeBtn');
    expect(removeRangeBtns).toHaveLength(2);
    fireEvent.click(removeRangeBtns[0]);

    // After removing, should have only one range left
    await waitFor(() => {
      expect(screen.getAllByLabelText('Start')).toHaveLength(1);
    });
  });
  it('Check adding range start and stop fields', async () => {
    render(
      <StateProvider>
        <QueryClientProvider client={queryClient}>
          <AutoIncrementEditForm {...props} />
        </QueryClientProvider>
      </StateProvider>
    );
    const addRangeBtn = screen.getByTestId('addNewRangeBtn');

    fireEvent.click(addRangeBtn);

    await waitFor(() => {
      expect(screen.getByLabelText('Start')).toBeTruthy();
      expect(screen.getByLabelText('Stop')).toBeTruthy();
    });
    // check that we have two inputs with zero values (initial state)
    const startInput = screen.getByLabelText('Start') as HTMLInputElement;
    const stopInput = screen.getByLabelText('Stop') as HTMLInputElement;
    expect(startInput.value).toBe('0');
    expect(stopInput.value).toBe('0');
  });
});
