// SPDX-License-Identifier: Apache-2.0

import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {DesignerCloseDraftDialog} from './designer-close-draft-dialog';

const ACTION_NAMES = [
  'Publish changes',
  'Save draft & exit',
  'Discard & exit',
  'Cancel',
] as const;

describe('DesignerCloseDraftDialog', () => {
  it('offers publish, save-draft, discard, and cancel actions', () => {
    const onPublishNow = vi.fn();
    const onKeepEditing = vi.fn();
    const onCloseKeepDraft = vi.fn();
    const onDiscardDraft = vi.fn();
    render(
      <DesignerCloseDraftDialog
        open
        animationDuration={0}
        onPublishNow={onPublishNow}
        onKeepEditing={onKeepEditing}
        onCloseKeepDraft={onCloseKeepDraft}
        onDiscardDraft={onDiscardDraft}
      />
    );

    expect(
      screen
        .getAllByRole('button')
        .filter(button => button.getAttribute('aria-label') !== 'close')
        .map(button => button.textContent)
    ).toEqual([...ACTION_NAMES]);
    expect(screen.queryByText(/Select an option to proceed/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', {name: 'Publish changes'}));
    fireEvent.click(screen.getByRole('button', {name: 'Save draft & exit'}));
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    fireEvent.click(screen.getByRole('button', {name: 'Discard & exit'}));
    fireEvent.click(
      screen.getByTestId('web-designer-close-draft-dismiss-button')
    );

    expect(onPublishNow).toHaveBeenCalledTimes(1);
    expect(onCloseKeepDraft).toHaveBeenCalledTimes(1);
    expect(onKeepEditing).toHaveBeenCalledTimes(2);
    expect(onDiscardDraft).toHaveBeenCalledTimes(1);
  });
});
