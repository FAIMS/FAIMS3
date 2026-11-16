// SPDX-License-Identifier: Apache-2.0

import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {DesignerPublishConflictDialog} from './designer-publish-conflict-dialog';

describe('DesignerPublishConflictDialog', () => {
  it('offers switch to latest, force publish, or download a backup', () => {
    const onDismiss = vi.fn();
    const onSwitchToLatest = vi.fn();
    const onForcePublish = vi.fn();
    const onDownloadBackup = vi.fn();
    render(
      <DesignerPublishConflictDialog
        open
        busy={false}
        animationDuration={0}
        onDismiss={onDismiss}
        onSwitchToLatest={onSwitchToLatest}
        onForcePublish={onForcePublish}
        onDownloadBackup={onDownloadBackup}
      />
    );

    fireEvent.click(
      screen.getByTestId('web-designer-conflict-switch-latest-button')
    );
    fireEvent.click(
      screen.getByTestId('web-designer-conflict-overwrite-button')
    );
    fireEvent.click(
      screen.getByTestId('web-designer-conflict-download-backup-button')
    );
    expect(onSwitchToLatest).toHaveBeenCalledTimes(1);
    expect(onForcePublish).toHaveBeenCalledTimes(1);
    expect(onDownloadBackup).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('web-designer-conflict-dismiss-button'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
