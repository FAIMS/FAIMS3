// SPDX-License-Identifier: Apache-2.0

import {migrateNotebook} from '@faims3/data-model';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import type {ComponentProps} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {DesignerWidget} from './DesignerWidget';
import {
  discardDraft,
  getDraft,
  setDraft,
  type DesignerDraftKey,
} from './integration/draftStorage';
import type {
  Notebook,
  NotebookUISpec,
  NotebookWithHistory,
} from './state/initial';
import {sampleNotebook} from './test-notebook';

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
  label = DRAFT_LABEL
) => {
  const draft = structuredClone(sampleNotebook) as Notebook;
  draft.uiSpec.fields['New-Text-Field']['component-parameters'].label = label;
  setDraft(key, {
    draft,
    published: structuredClone(sampleNotebook) as Notebook,
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

describe('DesignerWidget publish and close', () => {
  afterEach(() => {
    localStorage.clear();
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
      await screen.findByText(/field users will receive this design/i)
    ).toBeTruthy();
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
      'Saved'
    );
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
    });
    const publish = await screen.findByTestId('web-designer-save-button');
    await waitFor(() => expect(isButtonDisabled(publish)).toBe(false));
    fireEvent.click(publish);
    expect(
      await screen.findByText(/existing projects created from it are not/i)
    ).toBeTruthy();
  });

  it('closes after a successful publish-and-close and not after a failed PUT', async () => {
    seedUnpublishedDraft();
    const {onClose, publishNotebook} = renderWidget();
    publishNotebook.mockRejectedValueOnce(new Error('server error'));

    const publishAndClose = await screen.findByTestId(
      'web-designer-publish-and-close-button'
    );
    fireEvent.click(publishAndClose);
    fireEvent.click(
      await screen.findByTestId('web-designer-publish-confirm-button')
    );

    await waitFor(() => expect(publishNotebook).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('web-designer-shell')).toBeTruthy();
    expect(getDraft(identity)).toBeDefined();

    fireEvent.click(publishAndClose);
    fireEvent.click(
      await screen.findByTestId('web-designer-publish-confirm-button')
    );
    await waitFor(() => expect(publishNotebook).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onClose.mock.calls[0][0]).toBeUndefined();
  });

  it('closes immediately with no dialog or PUT when there is nothing to publish', async () => {
    const {onClose, publishNotebook} = renderWidget();
    const publishAndClose = await screen.findByTestId(
      'web-designer-publish-and-close-button'
    );
    fireEvent.click(publishAndClose);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(publishNotebook).not.toHaveBeenCalled();
    expect(screen.queryByText(/Publish changes\?/)).toBeNull();
  });

  it('warns on close when unpublished, keeps the draft, and discard clears storage', async () => {
    seedUnpublishedDraft();
    const {onClose, publishNotebook} = renderWidget();
    await screen.findByTestId('web-designer-shell');

    fireEvent.click(screen.getByTestId('web-designer-close-button'));
    expect(await screen.findByText(/local unpublished draft/i)).toBeTruthy();

    fireEvent.click(screen.getByTestId('web-designer-keep-editing-button'));
    await waitFor(() =>
      expect(screen.queryByText(/local unpublished draft/i)).toBeNull()
    );
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('web-designer-cancel-button'));
    fireEvent.click(
      await screen.findByTestId('web-designer-close-keep-draft-button')
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onClose.mock.calls[0][0]).toBeUndefined();
    expect(publishNotebook).not.toHaveBeenCalled();
    expect(getDraft(identity)).toBeDefined();
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

    fireEvent.click(screen.getByTestId('web-designer-close-button'));
    expect(screen.queryByText(/local unpublished draft/i)).toBeNull();
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

  it('keeps publish controls and status visible on Info', async () => {
    renderWidget();
    await screen.findByTestId('web-designer-save-button');
    fireEvent.click(screen.getByRole('tab', {name: 'Info'}));
    expect(screen.getByTestId('web-designer-save-button')).toBeTruthy();
    expect(
      screen.getByTestId('web-designer-publish-and-close-button')
    ).toBeTruthy();
    expect(screen.getByTestId('web-designer-draft-status').textContent).toBe(
      'Saved'
    );
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
