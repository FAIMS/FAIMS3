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
 */

import {render, screen, waitFor} from '@testing-library/react';
import RefreshNotebook from './refresh';
import userEvent from '@testing-library/user-event';
import {vi, test, expect} from 'vitest';
import {StateProvider} from '../../../context/store';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {act} from '@testing-library/react';

const testProjectName = 'Campus Survey Demo';
const testText = 'a few seconds ago';

const queryClient = new QueryClient();

test('Check refresh button', async () => {
  const handleRefresh = vi.fn(() => Promise.resolve());
  render(
    <StateProvider>
      <QueryClientProvider client={queryClient}>
        <RefreshNotebook
          project_name={testProjectName}
          handleRefresh={handleRefresh}
        />
      </QueryClientProvider>
    </StateProvider>
  );

  await act(async () => {
    const user = userEvent.setup();

    const refreshAlert = screen.getByTestId('refreshAlert');

    await waitFor(() => expect(refreshAlert.textContent).toContain(testText));

    const resetBtn = screen.getByTestId('refreshRecords');

    await user.click(resetBtn);

    await waitFor(() => expect(refreshAlert.textContent).toContain(testText));

    await waitFor(() => expect(handleRefresh).toHaveBeenCalledTimes(1));

    vi.useFakeTimers();
    setTimeout(() => {
      expect(refreshAlert.textContent).toContain(testText);
    }, 2000);
    vi.runAllTimers();
  });
});
