// SPDX-License-Identifier: Apache-2.0

import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {DesignerCloseDraftDialog} from './designer-close-draft-dialog';

describe('DesignerCloseDraftDialog', () => {
  it('offers publish, keep-draft, keep-working, and discard actions', () => {
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

    for (const name of [
      'Publish now',
      'Close and keep draft',
      'Keep working',
      'Close and discard draft',
    ]) {
      expect(screen.getByRole('button', {name}).className).toMatch(
        /MuiButton-outlined/
      );
    }

    fireEvent.click(screen.getByRole('button', {name: 'Publish now'}));
    fireEvent.click(screen.getByRole('button', {name: 'Close and keep draft'}));
    fireEvent.click(screen.getByRole('button', {name: 'Keep working'}));
    fireEvent.click(
      screen.getByRole('button', {name: 'Close and discard draft'})
    );
    fireEvent.click(
      screen.getByTestId('web-designer-close-draft-dismiss-button')
    );

    expect(onPublishNow).toHaveBeenCalledTimes(1);
    expect(onCloseKeepDraft).toHaveBeenCalledTimes(1);
    expect(onKeepEditing).toHaveBeenCalledTimes(2);
    expect(onDiscardDraft).toHaveBeenCalledTimes(1);
  });
});
