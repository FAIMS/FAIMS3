// SPDX-License-Identifier: Apache-2.0

import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {DesignerPublishConflictDialog} from './designer-publish-conflict-dialog';

describe('DesignerPublishConflictDialog', () => {
  it('offers keep working or overwrite the live design', () => {
    const onKeepWorking = vi.fn();
    const onOverwrite = vi.fn();
    render(
      <DesignerPublishConflictDialog
        open
        busy={false}
        animationDuration={0}
        onKeepWorking={onKeepWorking}
        onOverwrite={onOverwrite}
      />
    );

    expect(screen.getByText(/could not publish/i)).toBeTruthy();
    fireEvent.click(
      screen.getByTestId('web-designer-conflict-keep-working-button')
    );
    fireEvent.click(
      screen.getByTestId('web-designer-conflict-overwrite-button')
    );
    expect(onKeepWorking).toHaveBeenCalledTimes(1);
    expect(onOverwrite).toHaveBeenCalledTimes(1);
  });
});
