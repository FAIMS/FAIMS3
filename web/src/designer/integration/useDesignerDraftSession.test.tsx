// SPDX-License-Identifier: Apache-2.0

import {migrateNotebook} from '@faims3/data-model';
import {act, render, screen} from '@testing-library/react';
import {ActionCreators} from 'redux-undo';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createDesignerStore, type DesignerStore} from '../createDesignerStore';
import {toPublishedNotebook} from '../domain/notebook/adapters';
import type {Notebook, NotebookWithHistory} from '../state/initial';
import {sampleNotebook} from '../test-notebook';
import {fieldUpdated} from '../store/slices/uiSpec';
import {getDraft, setDraft, type DesignerDraftKey} from './draftStorage';
import {notebookDefinitionToDesignerHistory} from './notebookAdapters';
import {
  AUTOSAVE_DEBOUNCE_MS,
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
    </div>
  );
}

describe('useDesignerDraftSession', () => {
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('shows Saving draft… then Saved draft after an edit, without calling fetch', () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const store = createDesignerStore(historyFromSample());
    const published = toPublishedNotebook(store.getState().notebook);
    render(<Harness store={store} initialPublished={published} />);

    expect(screen.getByTestId('status').textContent).toBe('Saved draft');
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
    expect(screen.getByTestId('unpublished').textContent).toBe('false');
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
