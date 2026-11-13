// SPDX-License-Identifier: Apache-2.0

import {migrateNotebook} from '@faims3/data-model';
import {act, render, renderHook, screen} from '@testing-library/react';
import {ActionCreators} from 'redux-undo';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {config} from '@/constants';
import {createDesignerStore, type DesignerStore} from '../createDesignerStore';
import {toPublishedNotebook} from '../domain/notebook/adapters';
import type {Notebook, NotebookWithHistory} from '../state/initial';
import {sampleNotebook} from '../test-notebook';
import {fieldUpdated} from '../store/slices/uiSpec';
import {getDraft, setDraft, type DesignerDraftKey} from './draftStorage';
import {notebookDefinitionToDesignerHistory} from './notebookAdapters';
import {registerPendingEditFlush} from '../state/pendingEditFlush';
import {
  AUTOSAVE_DEBOUNCE_MS,
  resolveDesignerDraftDisplayStatus,
  resolveDesignerSessionNotebook,
  useDesignerDraftSession,
} from './useDesignerDraftSession';

const identity: DesignerDraftKey = {
  userId: 'user-1',
  resourceKind: 'projects',
  resourceId: 'proj-1',
};

const historyFromSample = (): NotebookWithHistory => {
  const {migrated} = migrateNotebook(structuredClone(sampleNotebook));
  return notebookDefinitionToDesignerHistory(migrated as Notebook);
};

const editFieldLabel = (store: DesignerStore, label: string) => {
  const fieldName = 'New-Text-Field';
  const field = store.getState().notebook.uiSpec.present.fields[fieldName];
  store.dispatch(
    fieldUpdated({
      fieldName,
      newField: {
        ...field,
        'component-parameters': {
          ...field['component-parameters'],
          label,
        },
      },
    })
  );
};

const LIVE_HASH = 'a'.repeat(64);

function Harness({
  store,
  initialPublished,
  publishedHash = LIVE_HASH,
}: {
  store: DesignerStore;
  initialPublished: ReturnType<typeof toPublishedNotebook>;
  publishedHash?: string;
}) {
  const session = useDesignerDraftSession({
    store,
    identity,
    initialPublished,
    publishedHash,
  });
  return (
    <div>
      <span data-testid="status">{session.statusCopy}</span>
      <span data-testid="unpublished">{String(session.isUnpublished)}</span>
      <button
        type="button"
        data-testid="mark-published"
        onClick={() =>
          session.markPublished(session.exportPresentNotebook(), publishedHash)
        }
      >
        Publish
      </button>
    </div>
  );
}

describe('useDesignerDraftSession', () => {
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('hides status until an edit, then shows Saving draft… then Saved draft', () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const store = createDesignerStore(historyFromSample());
    const published = toPublishedNotebook(store.getState().notebook);
    render(<Harness store={store} initialPublished={published} />);

    expect(screen.getByTestId('status').textContent).toBe('');
    expect(screen.getByTestId('unpublished').textContent).toBe('false');

    act(() => {
      editFieldLabel(store, 'Autosaved label');
    });
    expect(screen.getByTestId('status').textContent).toBe('Saving draft…');
    expect(screen.getByTestId('unpublished').textContent).toBe('true');

    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    });
    expect(screen.getByTestId('status').textContent).toBe('Saved draft');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(
      getDraft(identity)?.draft.uiSpec.fields['New-Text-Field'][
        'component-parameters'
      ].label
    ).toBe('Autosaved label');
  });

  it('shows the branded published copy after markPublished', () => {
    const store = createDesignerStore(historyFromSample());
    const published = toPublishedNotebook(store.getState().notebook);
    render(<Harness store={store} initialPublished={published} />);

    act(() => {
      editFieldLabel(store, 'Ready to publish');
    });
    act(() => {
      screen.getByTestId('mark-published').click();
    });
    expect(screen.getByTestId('unpublished').textContent).toBe('false');
    expect(screen.getByTestId('status').textContent).toBe(
      `${config.notebookNameCapitalized} published`
    );
  });

  it('rewrites the stored snapshot and hash after publish so the live design is not stale', () => {
    vi.useFakeTimers();
    const nextHash = 'b'.repeat(64);
    const store = createDesignerStore(historyFromSample());
    const published = toPublishedNotebook(store.getState().notebook);
    const {result} = renderHook(() =>
      useDesignerDraftSession({
        store,
        identity,
        initialPublished: published,
        publishedHash: LIVE_HASH,
      })
    );

    act(() => {
      editFieldLabel(store, 'Ready to publish');
    });
    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    });
    expect(getDraft(identity)?.publishedHash).toBe(LIVE_HASH);
    expect(
      getDraft(identity)?.published.uiSpec.fields['New-Text-Field'][
        'component-parameters'
      ].label
    ).not.toBe('Ready to publish');

    act(() => {
      result.current.markPublished(
        result.current.exportPresentNotebook(),
        nextHash
      );
    });

    const stored = getDraft(identity);
    expect(stored?.publishedHash).toBe(nextHash);
    expect(
      stored?.draft.uiSpec.fields['New-Text-Field']['component-parameters']
        .label
    ).toBe('Ready to publish');
    expect(
      stored?.published.uiSpec.fields['New-Text-Field']['component-parameters']
        .label
    ).toBe('Ready to publish');
    expect(result.current.isUnpublished).toBe(false);
  });

  it('persists the live uiSpec hash with the draft', () => {
    vi.useFakeTimers();
    const hash = 'a'.repeat(64);
    const store = createDesignerStore(historyFromSample());
    const published = toPublishedNotebook(store.getState().notebook);
    render(
      <Harness
        store={store}
        initialPublished={published}
        publishedHash={hash}
      />
    );

    act(() => {
      editFieldLabel(store, 'Hashed draft');
    });
    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    });
    expect(getDraft(identity)?.publishedHash).toBe(hash);
  });

  it('disables unpublished after undo back to the published snapshot', () => {
    vi.useFakeTimers();
    const store = createDesignerStore(historyFromSample());
    const published = toPublishedNotebook(store.getState().notebook);
    render(<Harness store={store} initialPublished={published} />);

    act(() => {
      editFieldLabel(store, 'Temporary');
    });
    expect(screen.getByTestId('unpublished').textContent).toBe('true');

    act(() => {
      store.dispatch(ActionCreators.undo());
    });
    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    });
    expect(screen.getByTestId('unpublished').textContent).toBe('false');
  });

  it('flushes pending editors before persist and export', () => {
    const store = createDesignerStore(historyFromSample());
    const published = toPublishedNotebook(store.getState().notebook);
    const unregister = registerPendingEditFlush(() => {
      editFieldLabel(store, 'Flushed keystroke');
    });
    const {result} = renderHook(() =>
      useDesignerDraftSession({
        store,
        identity,
        initialPublished: published,
        publishedHash: LIVE_HASH,
      })
    );

    let exported: Notebook | undefined;
    act(() => {
      exported = result.current.exportPresentNotebook();
    });
    expect(
      exported?.uiSpec.fields['New-Text-Field']['component-parameters'].label
    ).toBe('Flushed keystroke');

    act(() => {
      result.current.persistDraftNow();
    });
    expect(
      getDraft(identity)?.draft.uiSpec.fields['New-Text-Field'][
        'component-parameters'
      ].label
    ).toBe('Flushed keystroke');
    unregister();
  });

  it('surfaces a quota failure in the status copy', () => {
    vi.useFakeTimers();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException(
        'The quota has been exceeded.',
        'QuotaExceededError'
      );
    });
    const store = createDesignerStore(historyFromSample());
    const published = toPublishedNotebook(store.getState().notebook);
    render(<Harness store={store} initialPublished={published} />);

    act(() => {
      editFieldLabel(store, 'Will not persist');
    });
    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    });
    expect(screen.getByTestId('status').textContent).toMatch(
      /full|quota|Couldn't save/i
    );
  });
});

describe('resolveDesignerDraftDisplayStatus', () => {
  it('is idle until unpublished changes or an in-session publish', () => {
    expect(
      resolveDesignerDraftDisplayStatus({
        writeStatus: 'saved',
        isUnpublished: false,
        hasPublishedThisSession: false,
      })
    ).toBe('idle');
  });

  it('prefers saving and error over published or saved', () => {
    expect(
      resolveDesignerDraftDisplayStatus({
        writeStatus: 'saving',
        isUnpublished: true,
        hasPublishedThisSession: false,
      })
    ).toBe('saving');
    expect(
      resolveDesignerDraftDisplayStatus({
        writeStatus: 'error',
        isUnpublished: false,
        hasPublishedThisSession: true,
      })
    ).toBe('error');
  });

  it('shows saved while unpublished and published after a successful publish', () => {
    expect(
      resolveDesignerDraftDisplayStatus({
        writeStatus: 'saved',
        isUnpublished: true,
        hasPublishedThisSession: false,
      })
    ).toBe('saved');
    expect(
      resolveDesignerDraftDisplayStatus({
        writeStatus: 'saved',
        isUnpublished: false,
        hasPublishedThisSession: true,
      })
    ).toBe('published');
  });
});

describe('resolveDesignerSessionNotebook', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('restores a stored draft instead of the server notebook', () => {
    const server = historyFromSample();
    const draft = structuredClone(sampleNotebook);
    draft.uiSpec.fields['New-Text-Field']['component-parameters'].label =
      'Restored draft';
    setDraft(identity, {
      draft,
      published: toPublishedNotebook(server),
      publishedHash: LIVE_HASH,
    });

    const resolved = resolveDesignerSessionNotebook({
      identity,
      serverNotebook: server,
      mode: 'project',
    });
    expect(resolved.notebook).toBeDefined();
    expect(
      resolved.notebook!.uiSpec.present.fields['New-Text-Field'][
        'component-parameters'
      ].label
    ).toBe('Restored draft');
    expect(resolved.isStale).toBe(false);
  });

  it('marks a restored draft stale when the live hash has moved', () => {
    const server = historyFromSample();
    const draft = structuredClone(sampleNotebook);
    draft.uiSpec.fields['New-Text-Field']['component-parameters'].label =
      'Old draft';
    setDraft(identity, {
      draft,
      published: structuredClone(sampleNotebook),
      publishedHash: 'a'.repeat(64),
    });
    const resolved = resolveDesignerSessionNotebook({
      identity,
      serverNotebook: server,
      liveUiSpecHash: 'b'.repeat(64),
    });
    expect(resolved.isStale).toBe(true);
    expect(resolved.publishedHash).toBe('a'.repeat(64));
  });

  it('loads the live design when the stored draft has no unpublished changes', () => {
    const server = historyFromSample();
    setDraft(identity, {
      draft: toPublishedNotebook(server),
      published: toPublishedNotebook(server),
      publishedHash: 'a'.repeat(64),
    });

    const resolved = resolveDesignerSessionNotebook({
      identity,
      serverNotebook: server,
      liveUiSpecHash: 'b'.repeat(64),
    });
    expect(resolved.isStale).toBe(false);
    expect(resolved.publishedHash).toBe('b'.repeat(64));
  });

  it('does not restore a draft for a different resource id', () => {
    const server = historyFromSample();
    const draft = structuredClone(sampleNotebook);
    draft.uiSpec.fields['New-Text-Field']['component-parameters'].label =
      'Other project';
    setDraft(identity, {
      draft,
      published: structuredClone(sampleNotebook),
      publishedHash: LIVE_HASH,
    });

    const resolved = resolveDesignerSessionNotebook({
      identity: {...identity, resourceId: 'proj-2'},
      serverNotebook: server,
      mode: 'project',
    });
    expect(resolved.notebook).toBeDefined();
    expect(
      resolved.notebook!.uiSpec.present.fields['New-Text-Field'][
        'component-parameters'
      ].label
    ).toBe('Location Description');
  });
});
