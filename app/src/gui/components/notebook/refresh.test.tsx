// SPDX-License-Identifier: Apache-2.0

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
