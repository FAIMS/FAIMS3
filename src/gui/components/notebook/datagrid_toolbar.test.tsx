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

import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {GridToolbarSearchRecordDataButton} from './datagrid_toolbar';
import {expect, vi, test} from 'vitest';

const testText = 'Survey';

test('rendering and submitting search section', async () => {
  const handleSubmit = vi.fn(() => {});
  render(
    <GridToolbarSearchRecordDataButton handleQueryFunction={handleSubmit} />
  );
  const user = userEvent.setup();

  const input = screen.getByLabelText(/Search record/i);
  const searchBtn = screen.getByTestId('searchButton');
  const resetBtn = screen.getByTestId('searchReset');

  await waitFor(() => expect(handleSubmit).toHaveBeenCalledWith(''));

  await user.type(input, testText);

  await user.click(searchBtn);

  await waitFor(() => expect(handleSubmit).toHaveBeenCalledWith(testText));

  await waitFor(() => expect(handleSubmit).toHaveBeenCalledTimes(2));

  await user.click(resetBtn);

  await waitFor(() => expect(handleSubmit).toHaveBeenCalledWith(''));

  await waitFor(() => expect(handleSubmit).toHaveBeenCalledTimes(3));
});
