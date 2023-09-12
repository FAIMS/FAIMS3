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
import BasicAutoIncrementer from './edit-form';
import {expect, describe, it} from 'vitest';

const props = {
  project_id: '',
  form_id: '',
  field_id: '',
  label: '',
};

describe('Check edit-form component', () => {
  it('Check add btn', async () => {
    render(<BasicAutoIncrementer {...props} />);
    const addRangeBtn = screen.getByTestId('addNewRangeBtn');

    await waitFor(() => {
      expect(screen.queryByTestId('addRangeForm')).not.toBeTruthy();
    });

    fireEvent.click(addRangeBtn);

    await waitFor(() => {
      expect(screen.getByTestId('addRangeForm')).toBeTruthy();
    });
  });
  it('Check remove btn', async () => {
    render(<BasicAutoIncrementer {...props} />);
    const addRangeBtn = screen.getByTestId('addNewRangeBtn');

    await waitFor(() => {
      expect(screen.queryByTestId('addRangeForm')).not.toBeTruthy();
    });

    fireEvent.click(addRangeBtn);

    await waitFor(() => {
      expect(screen.getByTestId('addRangeForm')).toBeTruthy();
    });

    const removeRangeBtn = screen.getByTestId('removeRangeBtn');

    fireEvent.click(removeRangeBtn);

    await waitFor(() => {
      expect(screen.queryByTestId('addRangeForm')).not.toBeTruthy();
    });
  });
  it('Check adding range start and stop fields', async () => {
    render(<BasicAutoIncrementer {...props} />);
    const addRangeBtn = screen.getByTestId('addNewRangeBtn');

    await waitFor(() => {
      expect(screen.queryByTestId('addRangeForm')).not.toBeTruthy();
    });

    fireEvent.click(addRangeBtn);

    await waitFor(() => {
      expect(screen.getByTestId('addRangeForm')).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByTestId('rangeStart')).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByTestId('rangeStop')).toBeTruthy();
    });
  });
});
