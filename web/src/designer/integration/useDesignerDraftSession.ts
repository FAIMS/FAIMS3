// SPDX-License-Identifier: Apache-2.0

/**
 * @file Debounced local draft autosave, unpublished compare, and restore helper.
 */

import {useCallback, useEffect, useRef, useState} from 'react';
import type {DesignerStore} from '../createDesignerStore';
import {toPublishedNotebook} from '../domain/notebook/adapters';
import type {
  DesignerDocumentMode,
  Notebook,
  NotebookWithHistory,
} from '../state/initial';
import {flushPendingDesignerEdits} from '../state/pendingEditFlush';
import {
  type DesignerDraftKey,
  discardDraft,
  getDraft,
  setDraft,
  stableStringify,
  type DraftWriteResult,
} from './draftStorage';
import {hydrateExportedNotebook} from './notebookAdapters';

/** Autosave wait after the last store change that can appear in published JSON. */
export const AUTOSAVE_DEBOUNCE_MS = 500;

/** Visible draft-write status in the designer chrome. */
export type DesignerDraftStatus = 'saving' | 'saved' | 'error';

export type DesignerSessionIdentity = DesignerDraftKey;

/**
 * Status copy for the aria-live region. Uses an ellipsis while a write or
 * debounce is pending.
 */
export function designerDraftStatusCopy(
  status: DesignerDraftStatus,
  errorMessage?: string
): string {
  if (status === 'saving') {
    return 'Saving…';
  }
  if (status === 'error') {
    return errorMessage || "Couldn't save draft";
  }
  return 'Saved';
}

/**
 * Choose the session notebook: a stored draft hydrated through the load
 * adapters, or the server snapshot when none exists.
 */
export function resolveDesignerSessionNotebook({
  identity,
  serverNotebook,
  mode = 'project',
}: {
  identity?: DesignerSessionIdentity;
  serverNotebook?: NotebookWithHistory;
  mode?: DesignerDocumentMode;
}): {
  notebook?: NotebookWithHistory;
  published?: Notebook;
} {
  if (identity) {
    const stored = getDraft(identity);
    if (stored) {
      const restored = hydrateExportedNotebook(stored.draft, mode);
      if (restored) {
        return {notebook: restored, published: stored.published};
      }
    }
  }
  return {
    notebook: serverNotebook,
    published: serverNotebook ? toPublishedNotebook(serverNotebook) : undefined,
  };
}

export type DesignerDraftSession = {
  status: DesignerDraftStatus;
  statusCopy: string;
  errorMessage?: string;
  isUnpublished: boolean;
  isDraftWriteInFlight: boolean;
  isDebouncePending: boolean;
  persistDraftNow: () => DraftWriteResult;
  discardDraft: () => void;
  markPublished: (snapshot: Notebook) => void;
  exportPresentNotebook: () => Notebook;
};

/**
 * Subscribe to the designer store, autosave the present notebook after
 * {@link AUTOSAVE_DEBOUNCE_MS}, and track unpublished vs last-published.
 */
export function useDesignerDraftSession({
  store,
  identity,
  initialPublished,
}: {
  store: DesignerStore;
  identity?: DesignerSessionIdentity;
  initialPublished?: Notebook;
}): DesignerDraftSession {
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const publishedRef = useRef(initialPublished);
  const discardedRef = useRef(false);
  const flushingRef = useRef(false);
  const lastWrittenRef = useRef(
    stableStringify(toPublishedNotebook(store.getState().notebook))
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [published, setPublished] = useState(initialPublished);
  const [status, setStatus] = useState<DesignerDraftStatus>('saved');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [debouncePending, setDebouncePending] = useState(false);
  const [writeInFlight, setWriteInFlight] = useState(false);
  const [exportSignature, setExportSignature] = useState(
    lastWrittenRef.current
  );

  const exportPresentNotebook = useCallback((): Notebook => {
    flushPendingDesignerEdits();
    return toPublishedNotebook(store.getState().notebook);
  }, [store]);

  const persistDraftNow = useCallback((): DraftWriteResult => {
    if (discardedRef.current) {
      return {ok: true};
    }
    flushingRef.current = true;
    flushPendingDesignerEdits();
    flushingRef.current = false;

    const exported = toPublishedNotebook(store.getState().notebook);
    const signature = stableStringify(exported);
    setExportSignature(signature);

    const currentIdentity = identityRef.current;
    if (!currentIdentity) {
      lastWrittenRef.current = signature;
      setDebouncePending(false);
      setStatus('saved');
      setErrorMessage(undefined);
      return {ok: true};
    }

    setWriteInFlight(true);
    const result = setDraft(currentIdentity, {
      draft: exported,
      published: publishedRef.current ?? exported,
    });
    setWriteInFlight(false);
    setDebouncePending(false);

    if (result.ok) {
      lastWrittenRef.current = signature;
      setStatus('saved');
      setErrorMessage(undefined);
    } else {
      setStatus('error');
      setErrorMessage(result.error);
    }
    return result;
  }, [store]);

  const persistRef = useRef(persistDraftNow);
  persistRef.current = persistDraftNow;

  const schedulePersist = useCallback(() => {
    if (discardedRef.current || flushingRef.current) {
      return;
    }
    setDebouncePending(true);
    setStatus('saving');
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      persistRef.current();
    }, AUTOSAVE_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    discardedRef.current = false;
    publishedRef.current = initialPublished;
    setPublished(initialPublished);
    const signature = stableStringify(
      toPublishedNotebook(store.getState().notebook)
    );
    lastWrittenRef.current = signature;
    setExportSignature(signature);
    setStatus('saved');
    setErrorMessage(undefined);
    setDebouncePending(false);
    setWriteInFlight(false);

    const unsubscribe = store.subscribe(() => {
      if (flushingRef.current || discardedRef.current) {
        return;
      }
      const next = stableStringify(
        toPublishedNotebook(store.getState().notebook)
      );
      setExportSignature(next);
      if (!identityRef.current) {
        return;
      }
      if (next === lastWrittenRef.current) {
        return;
      }
      schedulePersist();
    });

    return () => {
      unsubscribe();
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        if (!discardedRef.current) {
          persistRef.current();
        }
      }
    };
    // Seed last-published only when the store/identity session starts. The
    // parent holds `initialPublished` stable for that session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    store,
    identity?.userId,
    identity?.resourceKind,
    identity?.resourceId,
    schedulePersist,
  ]);

  const handleDiscard = useCallback(() => {
    discardedRef.current = true;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setDebouncePending(false);
    setWriteInFlight(false);
    const currentIdentity = identityRef.current;
    if (currentIdentity) {
      discardDraft(currentIdentity);
    }
  }, []);

  const markPublished = useCallback((snapshot: Notebook) => {
    publishedRef.current = snapshot;
    setPublished(snapshot);
    const signature = stableStringify(snapshot);
    lastWrittenRef.current = signature;
    setExportSignature(signature);
    setStatus('saved');
    setErrorMessage(undefined);
  }, []);

  const publishedSignature = published ? stableStringify(published) : undefined;
  const isUnpublished = Boolean(
    publishedSignature && exportSignature !== publishedSignature
  );

  return {
    status,
    statusCopy: designerDraftStatusCopy(status, errorMessage),
    errorMessage,
    isUnpublished,
    isDraftWriteInFlight: writeInFlight,
    isDebouncePending: debouncePending,
    persistDraftNow,
    discardDraft: handleDiscard,
    markPublished,
    exportPresentNotebook,
  };
}
