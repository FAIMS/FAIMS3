// SPDX-License-Identifier: Apache-2.0

import {migrateNotebook} from '@faims3/data-model';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import type {ComponentProps} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {config} from '@/constants';
import {downloadFile} from '@/lib/utils';
import {DesignerWidget} from './DesignerWidget';
import {toPublishedNotebook} from './domain/notebook/adapters';
import {
  discardDraft,
  getDesignerDraftHostStatus,
  getDraft,
  setDraft,
  type DesignerDraftKey,
} from './integration/draftStorage';
import {DesignerUiSpecConflictError} from './integration/useDesignerSaveMutation';
import type {
  Notebook,
  NotebookUISpec,
  NotebookWithHistory,
} from './state/initial';
import {sampleNotebook} from './test-notebook';

vi.mock('@/lib/utils', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/utils')>();
  return {
    ...actual,
    downloadFile: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('./components/info-panel', () => ({InfoPanel: () => null}));
vi.mock('./components/design-panel', () => ({DesignPanel: () => null}));
vi.mock('./components/setup-form-panel', () => ({SetupFormPanel: () => null}));
vi.mock('./components/mdx-editor', () => ({MdxEditor: () => null}));
vi.mock('./components/design-search', () => ({
  DesignerGlobalSearch: () => null,
}));

const identity: DesignerDraftKey = {
  userId: 'user-1',
  resourceKind: 'projects',
  resourceId: 'proj-1',
};

const DRAFT_LABEL = 'DRAFT-ONLY-LABEL';
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

const serverNotebook = (): NotebookWithHistory => {
  const {migrated} = migrateNotebook(structuredClone(sampleNotebook));
  return {
    metadata: migrated.metadata,
    uiSpec: {
      present: migrated.uiSpec as NotebookUISpec,
      past: [],
      future: [],
    },
    planTemplates: [],
    plans: [],
  } as NotebookWithHistory;
};

const seedUnpublishedDraft = (
  key: DesignerDraftKey = identity,
  label = DRAFT_LABEL,
  publishedHash = HASH_A
) => {
  const draft = structuredClone(sampleNotebook) as Notebook;
  draft.uiSpec.fields['New-Text-Field']['component-parameters'].label = label;
  setDraft(key, {
    draft,
    published: toPublishedNotebook(serverNotebook()),
    publishedHash,
  });
};

const isButtonDisabled = (el: HTMLElement) =>
  (el as HTMLButtonElement).disabled ||
  el.getAttribute('aria-disabled') === 'true';

const renderWidget = (
  overrides: Partial<ComponentProps<typeof DesignerWidget>> = {}
) => {
  const onClose = vi.fn();
  const publishNotebook = vi.fn().mockResolvedValue({});
  const result = render(
    <DesignerWidget
      notebook={serverNotebook()}
      onClose={onClose}
      loadingDuration={0}
      animationDuration={0}
      userId={identity.userId}
      resourceKind={identity.resourceKind}
      resourceId={identity.resourceId}
      publishNotebook={publishNotebook}
      {...overrides}
    />
  );
  return {onClose, publishNotebook, ...result};
};

describe('DesignerWidget publish', () => {
  afterEach(() => {
    localStorage.clear();
    vi.mocked(downloadFile).mockClear();
    vi.restoreAllMocks();
  });

  it('disables Publish changes when there are no unpublished changes', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderWidget();
    const publish = await screen.findByTestId('web-designer-save-button');
    await waitFor(() => expect(isButtonDisabled(publish)).toBe(true));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('opens a project confirmation, publishes once, and stays open', async () => {
    seedUnpublishedDraft();
    const {onClose, publishNotebook} = renderWidget();
    const publish = await screen.findByTestId('web-designer-save-button');
    await waitFor(() => expect(isButtonDisabled(publish)).toBe(false));

    fireEvent.click(publish);
    expect(
      await screen.findByText(
        new RegExp(
          `Users will receive this ${config.notebookName} when they reopen or refresh the app`
        )
      )
    ).toBeTruthy();
    expect(
      screen.queryByTestId('web-designer-publish-records-warning')
    ).toBeNull();
    expect(publishNotebook).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('web-designer-publish-cancel-button'));
    await waitFor(() =>
      expect(
        screen.queryByTestId('web-designer-publish-confirm-button')
      ).toBeNull()
    );
    expect(publishNotebook).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(publish);
    fireEvent.click(
      await screen.findByTestId('web-designer-publish-confirm-button')
    );

    await waitFor(() => expect(publishNotebook).toHaveBeenCalledTimes(1));
    const file = publishNotebook.mock.calls[0][0] as File;
    expect(file.name).toMatch(/\.json$/);
    expect(
      getDraft(identity)?.published.uiSpec.fields['New-Text-Field'][
        'component-parameters'
      ].label
    ).toBe(DRAFT_LABEL);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('web-designer-shell')).toBeTruthy();
    await waitFor(() =>
      expect(
        isButtonDisabled(screen.getByTestId('web-designer-save-button'))
      ).toBe(true)
    );
    expect(screen.getByTestId('web-designer-draft-status').textContent).toBe(
      `${config.notebookNameCapitalized} published`
    );
  });

  it('aligns the stored draft with the new live hash so close does not look stale', async () => {
    seedUnpublishedDraft();
    const {publishNotebook} = renderWidget({liveUiSpecHash: HASH_A});
    publishNotebook.mockResolvedValue({
      uiSpecProperties: {hash: HASH_B},
    });

    const publish = await screen.findByTestId('web-designer-save-button');
    await waitFor(() => expect(isButtonDisabled(publish)).toBe(false));
    fireEvent.click(publish);
    fireEvent.click(
      await screen.findByTestId('web-designer-publish-confirm-button')
    );

    await waitFor(() => expect(publishNotebook).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getDraft(identity)?.publishedHash).toBe(HASH_B));
    expect(getDesignerDraftHostStatus(identity, {uiSpecHash: HASH_B})).toEqual({
      unpublished: false,
      stale: false,
    });
  });

  it('uses template confirmation copy in template mode', async () => {
    seedUnpublishedDraft({
      userId: 'user-1',
      resourceKind: 'templates',
      resourceId: 'tmpl-1',
    });
    renderWidget({
      designerMode: 'template',
      resourceKind: 'templates',
      resourceId: 'tmpl-1',
      existingRecordCount: 12,
    });
    const publish = await screen.findByTestId('web-designer-save-button');
    await waitFor(() => expect(isButtonDisabled(publish)).toBe(false));
    fireEvent.click(publish);
    expect(
      await screen.findByText(
        new RegExp(
          `existing ${config.notebookNamePlural} created from it are not`,
          'i'
        )
      )
    ).toBeTruthy();
    expect(
      screen.queryByTestId('web-designer-publish-records-warning')
    ).toBeNull();
  });

  it('warns that existing survey records can be lost', async () => {
    seedUnpublishedDraft();
    renderWidget({existingRecordCount: 3});
    const publish = await screen.findByTestId('web-designer-save-button');
    await waitFor(() => expect(isButtonDisabled(publish)).toBe(false));
    fireEvent.click(publish);
    const warning = await screen.findByTestId(
      'web-designer-publish-records-warning'
    );
    expect(warning.textContent).toMatch(/collected data/i);
    expect(warning.textContent).toMatch(/3 records/);
    expect(warning.textContent).toMatch(/loss of this data/i);
  });

  it('warns on close when unpublished, keeps the draft, and discard clears storage', async () => {
    seedUnpublishedDraft();
    const {onClose, publishNotebook} = renderWidget();
    await screen.findByTestId('web-designer-shell');

    fireEvent.click(screen.getByTestId('web-designer-close-button'));
    expect(await screen.findByText(/You have unsaved changes/i)).toBeTruthy();

    fireEvent.click(screen.getByTestId('web-designer-keep-editing-button'));
    await waitFor(() =>
      expect(screen.queryByText(/You have unsaved changes/i)).toBeNull()
    );
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('web-designer-close-button'));
    expect(await screen.findByRole('button', {name: 'Cancel'})).toBeTruthy();
    expect(
      screen.getByRole('button', {name: 'Save draft & exit'})
    ).toBeTruthy();
    fireEvent.click(
      await screen.findByTestId('web-designer-close-keep-draft-button')
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onClose.mock.calls[0][0]).toBeUndefined();
    expect(publishNotebook).not.toHaveBeenCalled();
    expect(getDraft(identity)).toBeDefined();
  });

  it('opens the publish dialog from Publish changes and does not close the editor', async () => {
    seedUnpublishedDraft();
    const {onClose, publishNotebook} = renderWidget();
    await screen.findByTestId('web-designer-shell');
    fireEvent.click(screen.getByTestId('web-designer-close-button'));
    fireEvent.click(
      await screen.findByTestId('web-designer-close-publish-now-button')
    );
    expect(
      await screen.findByText('Are you sure you want to publish these changes?')
    ).toBeTruthy();
    expect(screen.queryByText(/You have unsaved changes/i)).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(publishNotebook).not.toHaveBeenCalled();
  });

  it('discard draft removes storage and closes without PUT', async () => {
    seedUnpublishedDraft();
    const {onClose, publishNotebook} = renderWidget();
    await screen.findByTestId('web-designer-shell');
    fireEvent.click(screen.getByTestId('web-designer-close-button'));
    fireEvent.click(
      await screen.findByTestId('web-designer-discard-draft-button')
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onClose.mock.calls[0][0]).toBeUndefined();
    expect(publishNotebook).not.toHaveBeenCalled();
    expect(getDraft(identity)).toBeUndefined();
  });

  it('closes with no warning when the draft matches the published snapshot', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const {onClose} = renderWidget();
    await screen.findByTestId('web-designer-shell');
    expect(addSpy.mock.calls.some(call => call[0] === 'beforeunload')).toBe(
      false
    );

    expect(screen.queryByTestId('web-designer-cancel-button')).toBeNull();
    const close = screen.getByRole('button', {name: 'close designer'});
    expect(close.textContent).toContain('Close');
    fireEvent.click(close);
    expect(screen.queryByText(/You have unsaved changes/i)).toBeNull();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('registers beforeunload while unpublished', async () => {
    seedUnpublishedDraft();
    const addSpy = vi.spyOn(window, 'addEventListener');
    renderWidget();
    await screen.findByTestId('web-designer-shell');
    await waitFor(() =>
      expect(addSpy.mock.calls.some(call => call[0] === 'beforeunload')).toBe(
        true
      )
    );
  });

  it('keeps publish controls visible on Info and hides idle draft status', async () => {
    renderWidget();
    await screen.findByTestId('web-designer-save-button');
    fireEvent.click(screen.getByRole('tab', {name: 'Info'}));
    expect(screen.getByTestId('web-designer-save-button')).toBeTruthy();
    expect(screen.queryByTestId('web-designer-draft-status')).toBeNull();
  });

  it('keeps Saved draft visible on Info while unpublished', async () => {
    seedUnpublishedDraft();
    renderWidget();
    await screen.findByTestId('web-designer-save-button');
    fireEvent.click(screen.getByRole('tab', {name: 'Info'}));
    expect(screen.getByTestId('web-designer-draft-status').textContent).toBe(
      'Saved draft'
    );
  });

  it('does not warn on open when a stored draft has no unpublished changes', async () => {
    setDraft(identity, {
      draft: structuredClone(sampleNotebook) as Notebook,
      published: structuredClone(sampleNotebook) as Notebook,
      publishedHash: HASH_A,
    });
    renderWidget({liveUiSpecHash: HASH_B});
    await screen.findByTestId('web-designer-shell');
    expect(
      screen.queryByTestId('web-designer-stale-load-live-button')
    ).toBeNull();
    expect(screen.queryByTestId('web-designer-stale-draft-banner')).toBeNull();
  });

  it('warns on open when the local draft is based on an older live hash', async () => {
    seedUnpublishedDraft(identity, DRAFT_LABEL, HASH_A);
    renderWidget({liveUiSpecHash: HASH_B, exportBaseName: 'Field Survey'});
    expect(
      await screen.findByRole('button', {
        name: 'Discard draft & edit latest version',
      })
    ).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Download backup'})).toBeTruthy();
    expect(
      screen.getByRole('button', {name: 'Work on my version'})
    ).toBeTruthy();

    fireEvent.click(
      screen.getByTestId('web-designer-stale-download-backup-button')
    );
    expect(downloadFile).toHaveBeenCalledTimes(1);
    expect(vi.mocked(downloadFile).mock.calls[0][1]).toBe(
      'Field-Survey-draft-backup.json'
    );
    expect(getDraft(identity)).toBeDefined();
    expect(
      screen.getByTestId('web-designer-stale-load-live-button')
    ).toBeTruthy();
  });

  it('continues with the stale draft and shows a warning banner', async () => {
    seedUnpublishedDraft(identity, DRAFT_LABEL, HASH_A);
    renderWidget({liveUiSpecHash: HASH_B});
    fireEvent.click(
      await screen.findByTestId('web-designer-stale-continue-button')
    );
    expect(
      await screen.findByTestId('web-designer-stale-draft-banner')
    ).toBeTruthy();
    expect(getDraft(identity)).toBeDefined();
    expect(
      screen.queryByTestId('web-designer-stale-load-live-button')
    ).toBeNull();
  });

  it('closes the overlay from the stale dialog without discarding the draft', async () => {
    seedUnpublishedDraft(identity, DRAFT_LABEL, HASH_A);
    const {onClose} = renderWidget({liveUiSpecHash: HASH_B});
    fireEvent.click(
      await screen.findByTestId('web-designer-stale-dismiss-button')
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onClose.mock.calls[0][0]).toBeUndefined();
    expect(getDraft(identity)).toBeDefined();
  });

  it('discards the local draft and loads the latest design', async () => {
    seedUnpublishedDraft(identity, DRAFT_LABEL, HASH_A);
    renderWidget({liveUiSpecHash: HASH_B});
    fireEvent.click(
      await screen.findByTestId('web-designer-stale-load-live-button')
    );
    await waitFor(() => expect(getDraft(identity)).toBeUndefined());
    expect(
      screen.queryByTestId('web-designer-stale-load-live-button')
    ).toBeNull();
  });

  it('sends If-Match from the stored published hash', async () => {
    seedUnpublishedDraft(identity, DRAFT_LABEL, HASH_A);
    const {publishNotebook} = renderWidget({liveUiSpecHash: HASH_A});
    const publish = await screen.findByTestId('web-designer-save-button');
    await waitFor(() => expect(isButtonDisabled(publish)).toBe(false));
    fireEvent.click(publish);
    fireEvent.click(
      await screen.findByTestId('web-designer-publish-confirm-button')
    );
    await waitFor(() => expect(publishNotebook).toHaveBeenCalledTimes(1));
    expect(publishNotebook.mock.calls[0][1]).toEqual({ifMatch: HASH_A});
  });

  it('opens a conflict dialog on 409 and overwrites without If-Match', async () => {
    seedUnpublishedDraft(identity, DRAFT_LABEL, HASH_A);
    const {publishNotebook} = renderWidget({liveUiSpecHash: HASH_A});
    publishNotebook.mockRejectedValueOnce(new DesignerUiSpecConflictError());
    publishNotebook.mockResolvedValueOnce({
      uiSpecProperties: {hash: HASH_B},
    });

    const publish = await screen.findByTestId('web-designer-save-button');
    await waitFor(() => expect(isButtonDisabled(publish)).toBe(false));
    fireEvent.click(publish);
    fireEvent.click(
      await screen.findByTestId('web-designer-publish-confirm-button')
    );

    expect(
      await screen.findByTestId('web-designer-conflict-overwrite-button')
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {name: 'Switch to latest version'})
    ).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Download backup'})).toBeTruthy();
    expect(publishNotebook).toHaveBeenCalledTimes(1);
    expect(publishNotebook.mock.calls[0][1]).toEqual({ifMatch: HASH_A});

    fireEvent.click(
      screen.getByTestId('web-designer-conflict-overwrite-button')
    );
    await waitFor(() => expect(publishNotebook).toHaveBeenCalledTimes(2));
    expect(publishNotebook.mock.calls[1][1]).toBeUndefined();
  });

  it('downloads a JSON backup of the local draft without publishing again', async () => {
    seedUnpublishedDraft(identity, DRAFT_LABEL, HASH_A);
    const {publishNotebook} = renderWidget({
      liveUiSpecHash: HASH_A,
      exportBaseName: 'Field Survey',
    });
    publishNotebook.mockRejectedValueOnce(new DesignerUiSpecConflictError());

    const publish = await screen.findByTestId('web-designer-save-button');
    await waitFor(() => expect(isButtonDisabled(publish)).toBe(false));
    fireEvent.click(publish);
    fireEvent.click(
      await screen.findByTestId('web-designer-publish-confirm-button')
    );

    fireEvent.click(
      await screen.findByTestId('web-designer-conflict-download-backup-button')
    );
    expect(downloadFile).toHaveBeenCalledTimes(1);
    const [blob, filename] = vi.mocked(downloadFile).mock.calls[0];
    expect(filename).toBe('Field-Survey-draft-backup.json');
    expect(blob).toBeInstanceOf(Blob);
    expect(publishNotebook).toHaveBeenCalledTimes(1);
    expect(
      screen.getByTestId('web-designer-conflict-overwrite-button')
    ).toBeTruthy();
    expect(getDraft(identity)).toBeDefined();
  });

  it('returns to the editor from a publish conflict without overwriting', async () => {
    seedUnpublishedDraft(identity, DRAFT_LABEL, HASH_A);
    const {onClose, publishNotebook} = renderWidget({liveUiSpecHash: HASH_A});
    publishNotebook.mockRejectedValueOnce(new DesignerUiSpecConflictError());

    const publish = await screen.findByTestId('web-designer-save-button');
    await waitFor(() => expect(isButtonDisabled(publish)).toBe(false));
    fireEvent.click(publish);
    fireEvent.click(
      await screen.findByTestId('web-designer-publish-confirm-button')
    );

    fireEvent.click(
      await screen.findByTestId('web-designer-conflict-dismiss-button')
    );
    await waitFor(() =>
      expect(
        screen.queryByTestId('web-designer-conflict-overwrite-button')
      ).toBeNull()
    );
    expect(publishNotebook).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(getDraft(identity)).toBeDefined();
    expect(screen.getByTestId('web-designer-shell')).toBeTruthy();
  });

  it('switches to the live design from a publish conflict without publishing', async () => {
    seedUnpublishedDraft(identity, DRAFT_LABEL, HASH_A);
    const {publishNotebook} = renderWidget({liveUiSpecHash: HASH_A});
    publishNotebook.mockRejectedValueOnce(new DesignerUiSpecConflictError());

    const publish = await screen.findByTestId('web-designer-save-button');
    await waitFor(() => expect(isButtonDisabled(publish)).toBe(false));
    fireEvent.click(publish);
    fireEvent.click(
      await screen.findByTestId('web-designer-publish-confirm-button')
    );

    fireEvent.click(
      await screen.findByTestId('web-designer-conflict-switch-latest-button')
    );
    await waitFor(() => expect(getDraft(identity)).toBeUndefined());
    expect(publishNotebook).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByTestId('web-designer-conflict-overwrite-button')
    ).toBeNull();
  });

  it('refetches the live design when switching to latest after a 409', async () => {
    seedUnpublishedDraft(identity, DRAFT_LABEL, HASH_A);
    const refreshLiveDesign = vi.fn().mockResolvedValue({
      notebook: serverNotebook(),
      liveUiSpecHash: HASH_B,
    });
    const {publishNotebook} = renderWidget({
      liveUiSpecHash: HASH_A,
      refreshLiveDesign,
    });
    publishNotebook.mockRejectedValueOnce(new DesignerUiSpecConflictError());

    const publish = await screen.findByTestId('web-designer-save-button');
    await waitFor(() => expect(isButtonDisabled(publish)).toBe(false));
    fireEvent.click(publish);
    fireEvent.click(
      await screen.findByTestId('web-designer-publish-confirm-button')
    );

    fireEvent.click(
      await screen.findByTestId('web-designer-conflict-switch-latest-button')
    );
    await waitFor(() => expect(refreshLiveDesign).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        screen
          .getByTestId('web-designer-shell')
          .getAttribute('data-published-hash')
      ).toBe(HASH_B)
    );
    expect(getDraft(identity)).toBeUndefined();
    expect(publishNotebook).toHaveBeenCalledTimes(1);
  });

  it('does not call fetch during restore of an unpublished draft', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    seedUnpublishedDraft();
    renderWidget();
    await screen.findByTestId('web-designer-save-button');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('discard then reopen', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('loads the server design after discard', () => {
    seedUnpublishedDraft();
    discardDraft(identity);
    expect(getDraft(identity)).toBeUndefined();
  });
});
