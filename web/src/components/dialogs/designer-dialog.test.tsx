// SPDX-License-Identifier: Apache-2.0

import {render, screen, waitFor} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {NotebookWithHistory} from '../../designer/state/initial';
import {DesignerDialog} from './designer-dialog';

vi.mock('../../designer/DesignerWidget', () => ({
  DesignerWidget: ({
    notebook,
    liveUiSpecHash,
  }: {
    notebook?: NotebookWithHistory;
    liveUiSpecHash?: string;
  }) => (
    <div
      data-testid="web-designer-widget"
      data-hash={liveUiSpecHash ?? ''}
      data-purpose={String(
        notebook?.metadata?.information?.purposeMarkdown ?? ''
      )}
    />
  ),
}));

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

const notebookWithPurpose = (purposeMarkdown: string): NotebookWithHistory =>
  ({
    metadata: {information: {purposeMarkdown}},
  }) as NotebookWithHistory;

const renderDialog = (
  overrides: Partial<Parameters<typeof DesignerDialog>[0]> = {}
) => {
  const onClose = vi.fn();
  const publishNotebook = vi.fn().mockResolvedValue({});
  const result = render(
    <DesignerDialog
      open
      notebook={notebookWithPurpose('cached')}
      onClose={onClose}
      animationDuration={0}
      userId="user-1"
      resourceKind="projects"
      resourceId="proj-1"
      publishNotebook={publishNotebook}
      liveUiSpecHash={HASH_A}
      {...overrides}
    />
  );
  return {onClose, publishNotebook, ...result};
};

describe('DesignerDialog live source', () => {
  it('refetches the live source before pinning the overlay session', async () => {
    const refreshLiveDesign = vi.fn().mockResolvedValue({
      notebook: notebookWithPurpose('fresh'),
      liveUiSpecHash: HASH_B,
    });
    renderDialog({refreshLiveDesign});

    const widget = await screen.findByTestId('web-designer-widget');
    expect(refreshLiveDesign).toHaveBeenCalledTimes(1);
    expect(widget.getAttribute('data-hash')).toBe(HASH_B);
    expect(widget.getAttribute('data-purpose')).toBe('fresh');
  });

  it('shows a loading state until the live GET settles', async () => {
    let resolveFresh: (value: {
      notebook: NotebookWithHistory;
      liveUiSpecHash: string;
    }) => void = () => {};
    const refreshLiveDesign = vi.fn(
      () =>
        new Promise<{
          notebook: NotebookWithHistory;
          liveUiSpecHash: string;
        }>(resolve => {
          resolveFresh = resolve;
        })
    );
    renderDialog({refreshLiveDesign});

    expect(
      await screen.findByTestId('web-designer-live-source-loading')
    ).toBeTruthy();
    expect(screen.queryByTestId('web-designer-widget')).toBeNull();

    resolveFresh({
      notebook: notebookWithPurpose('fresh'),
      liveUiSpecHash: HASH_B,
    });

    const widget = await screen.findByTestId('web-designer-widget');
    expect(widget.getAttribute('data-hash')).toBe(HASH_B);
    expect(screen.queryByTestId('web-designer-live-source-loading')).toBeNull();
  });

  it('keeps the cached snapshot when the live GET fails', async () => {
    const refreshLiveDesign = vi.fn().mockRejectedValue(new Error('network'));
    renderDialog({refreshLiveDesign});

    const widget = await screen.findByTestId('web-designer-widget');
    expect(widget.getAttribute('data-hash')).toBe(HASH_A);
    expect(widget.getAttribute('data-purpose')).toBe('cached');
  });

  it('does not refetch when a same-session notebook prop changes', async () => {
    const refreshLiveDesign = vi.fn().mockResolvedValue({
      notebook: notebookWithPurpose('fresh'),
      liveUiSpecHash: HASH_B,
    });
    const {rerender, onClose, publishNotebook} = renderDialog({
      refreshLiveDesign,
    });
    await screen.findByTestId('web-designer-widget');

    rerender(
      <DesignerDialog
        open
        notebook={notebookWithPurpose('refetched-cache')}
        onClose={onClose}
        animationDuration={0}
        userId="user-1"
        resourceKind="projects"
        resourceId="proj-1"
        publishNotebook={publishNotebook}
        liveUiSpecHash={'c'.repeat(64)}
        refreshLiveDesign={refreshLiveDesign}
      />
    );

    await waitFor(() => expect(refreshLiveDesign).toHaveBeenCalledTimes(1));
    const widget = screen.getByTestId('web-designer-widget');
    expect(widget.getAttribute('data-hash')).toBe(HASH_B);
    expect(widget.getAttribute('data-purpose')).toBe('fresh');
  });

  it('pins cached props immediately when no live refresh is provided', async () => {
    renderDialog();
    const widget = await screen.findByTestId('web-designer-widget');
    expect(widget.getAttribute('data-hash')).toBe(HASH_A);
    expect(widget.getAttribute('data-purpose')).toBe('cached');
  });

  it('reopens visibly and refetches when opened again during the close animation', async () => {
    const refreshLiveDesign = vi
      .fn()
      .mockResolvedValueOnce({
        notebook: notebookWithPurpose('first'),
        liveUiSpecHash: HASH_A,
      })
      .mockResolvedValueOnce({
        notebook: notebookWithPurpose('second'),
        liveUiSpecHash: HASH_B,
      });
    const onClose = vi.fn();
    const publishNotebook = vi.fn().mockResolvedValue({});
    const props = {
      notebook: notebookWithPurpose('cached'),
      onClose,
      animationDuration: 5000,
      userId: 'user-1',
      resourceKind: 'projects' as const,
      resourceId: 'proj-1',
      publishNotebook,
      liveUiSpecHash: HASH_A,
      refreshLiveDesign,
    };
    const {rerender} = render(<DesignerDialog open {...props} />);
    expect(
      (await screen.findByTestId('web-designer-widget')).getAttribute(
        'data-purpose'
      )
    ).toBe('first');
    expect(refreshLiveDesign).toHaveBeenCalledTimes(1);

    rerender(<DesignerDialog open={false} {...props} />);
    expect(screen.getByTestId('web-designer-dialog-overlay')).toBeTruthy();

    rerender(<DesignerDialog open {...props} />);
    await waitFor(() => {
      expect(refreshLiveDesign).toHaveBeenCalledTimes(2);
      expect(
        screen.getByTestId('web-designer-widget').getAttribute('data-purpose')
      ).toBe('second');
    });
    await waitFor(() =>
      expect(
        screen
          .getByTestId('web-designer-dialog-overlay')
          .getAttribute('data-visible')
      ).toBe('true')
    );
  });
});
