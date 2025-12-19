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
 * Filename: delete.test.tsx
 * Description:
 *   TODO
 */

import {TestWrapper} from '../../testUtils';
import RecordDelete from './delete';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {expect, vi, test} from 'vitest';

const testDeleteData = {
  projectId: 'test-id',
  recordId: 'test-record-id',
  revisionId: 'test-revision-id',
  showLabel: true,
  handleRefresh: vi.fn(() => {
    return new Promise<any>(() => {});
  }),
};

vi.mock('../../../sync/draft-storage', () => ({
  deleteStagedData: vi.fn(() => {}),
}));

test('Check delete component', async () => {
  render(
    <TestWrapper>
      <RecordDelete serverId={'todo'} {...testDeleteData} />
    </TestWrapper>
  );
  expect(screen.getByTestId('delete-btn')).toBeTruthy();

  fireEvent.click(screen.getByTestId('delete-btn'));

  expect(screen.getByText('Cancel')).toBeTruthy();

  expect(screen.getByTestId('confirm-delete')).toBeTruthy();

  fireEvent.click(screen.getByTestId('confirm-delete'));

  await waitFor(() => {
    // This is no longer valid as there is no staged data - see #1825
    // expect(deleteStagedData).toBeCalledTimes(1);
  });
});
