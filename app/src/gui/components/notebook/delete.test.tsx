// SPDX-License-Identifier: Apache-2.0

/*
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
};

test('Check delete component', async () => {
  render(
    <TestWrapper>
      <RecordDelete {...testDeleteData} />
    </TestWrapper>
  );
  expect(screen.getByTestId('delete-btn')).toBeTruthy();

  fireEvent.click(screen.getByTestId('delete-btn'));

  expect(screen.getByText('Cancel')).toBeTruthy();

  const confirmBtn = screen.getByTestId('confirm-delete') as HTMLButtonElement;
  expect(confirmBtn.disabled).toBe(true);

  fireEvent.click(
    screen.getByRole('checkbox', {name: /i understand this cannot be undone/i})
  );

  expect(confirmBtn.disabled).toBe(false);

  fireEvent.click(confirmBtn);
});
