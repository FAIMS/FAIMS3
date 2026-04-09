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

import {expect, test, vi} from 'vitest';

// Stub permission check so we exercise dialog UX; TestWrapper’s token/setup
// does not yield canDeleteProjectRecord === true with the real permission code.
vi.mock('@faims3/data-model', async importOriginal => {
  const mod = await importOriginal<typeof import('@faims3/data-model')>();
  return {
    ...mod,
    canDeleteProjectRecord: vi.fn(() => true),
  };
});

import {TestWrapper} from '../../testUtils';
import RecordDelete from './delete';
import {fireEvent, render, screen} from '@testing-library/react';

const testDeleteData = {
  projectId: 'test-id',
  recordCreatedBy: 'testuser',
  recordId: 'test-record-id',
  revisionId: 'test-revision-id',
  showLabel: true,
  handleRefresh: vi.fn(() => {
    return new Promise<any>(() => {});
  }),
};

test('Check delete component', async () => {
  render(
    <TestWrapper>
      <RecordDelete serverId={'todo'} {...testDeleteData} />
    </TestWrapper>
  );
  expect(screen.getByTestId('delete-btn')).toBeTruthy();

  fireEvent.click(screen.getByTestId('delete-btn'));

  expect(screen.getByText('Cancel')).toBeTruthy();

  const confirmBtn = screen.getByTestId(
    'confirm-delete'
  ) as HTMLButtonElement;
  expect(confirmBtn.disabled).toBe(true);

  fireEvent.click(
    screen.getByRole('checkbox', {name: /i understand this cannot be undone/i})
  );

  expect(confirmBtn.disabled).toBe(false);

  fireEvent.click(confirmBtn);
});
