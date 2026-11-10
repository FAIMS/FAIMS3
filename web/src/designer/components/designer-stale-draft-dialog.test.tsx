// SPDX-License-Identifier: Apache-2.0

import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {DesignerStaleDraftDialog} from './designer-stale-draft-dialog';

describe('DesignerStaleDraftDialog', () => {
  it('offers continue with the local draft or load the latest version', () => {
    const onContinue = vi.fn();
    const onDiscardAndLoadLive = vi.fn();
    render(
      <DesignerStaleDraftDialog
        open
        animationDuration={0}
        onContinue={onContinue}
        onDiscardAndLoadLive={onDiscardAndLoadLive}
      />
    );

    expect(screen.getByText(/this design has changed/i)).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Discard draft and load latest version',
      })
    ).toBeTruthy();
    fireEvent.click(screen.getByTestId('web-designer-stale-continue-button'));
    fireEvent.click(screen.getByTestId('web-designer-stale-load-live-button'));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onDiscardAndLoadLive).toHaveBeenCalledTimes(1);
  });
});
