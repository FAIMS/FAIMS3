// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: Dialog.test.tsx
 */

import {render, screen} from '@testing-library/react';
import FaimsAttachmentManagerDialog from './Faims_Attachment_Manager_Dialog';
import {expect, vi, describe, it} from 'vitest';

const testData = {
  open: true,
  project_id: 'test-dialog-id',
  setopen: vi.fn(() => {}),
  filedId: 'test',
  isSyncing: 'true',
  serverId: 'todo',
};

describe('Check dialog component', () => {
  it('Check with path', () => {
    render(<FaimsAttachmentManagerDialog {...testData} path={'test-path'} />);

    expect(screen.getByTestId('dialog-img')).toBeTruthy();
  });
});
