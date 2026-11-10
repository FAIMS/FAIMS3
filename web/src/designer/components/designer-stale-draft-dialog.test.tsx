// SPDX-License-Identifier: Apache-2.0

import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {config} from '@/constants';
import {DesignerStaleDraftDialog} from './designer-stale-draft-dialog';

describe('DesignerStaleDraftDialog', () => {
  it('offers switch to latest, work on my version, or download a JSON backup', () => {
    const onDismiss = vi.fn();
    const onSwitchToLatest = vi.fn();
    const onWorkOnMyVersion = vi.fn();
    const onDownloadBackup = vi.fn();
    render(
      <DesignerStaleDraftDialog
        open
        animationDuration={0}
        onDismiss={onDismiss}
        onSwitchToLatest={onSwitchToLatest}
        onWorkOnMyVersion={onWorkOnMyVersion}
        onDownloadBackup={onDownloadBackup}
      />
    );

    expect(screen.getByText(/this design has changed/i)).toBeTruthy();
    expect(
      screen.getByText(
        new RegExp(
          `The ${config.notebookName} has been updated remotely since you created your draft`
        )
      )
    ).toBeTruthy();
    expect(
      screen.getByText(
        /you may continue working on your stale draft, but beware that you will need to overwrite the latest version in order to save it/i
      )
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {name: 'Switch to latest version'})
    ).toBeTruthy();
    const workOnMyVersion = screen.getByRole('button', {
      name: 'Work on my version',
    });
    expect(workOnMyVersion).toBeTruthy();
    expect(workOnMyVersion.className).toMatch(/MuiButton-colorWarning/);
    expect(
      screen.getByRole('button', {name: 'Download JSON backup'})
    ).toBeTruthy();

    fireEvent.click(screen.getByTestId('web-designer-stale-load-live-button'));
    fireEvent.click(screen.getByTestId('web-designer-stale-continue-button'));
    fireEvent.click(
      screen.getByTestId('web-designer-stale-download-backup-button')
    );
    fireEvent.click(screen.getByTestId('web-designer-stale-dismiss-button'));
    expect(onSwitchToLatest).toHaveBeenCalledTimes(1);
    expect(onWorkOnMyVersion).toHaveBeenCalledTimes(1);
    expect(onDownloadBackup).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
