// SPDX-License-Identifier: Apache-2.0

/**
 * @file Debounced local draft autosave, unpublished compare, and restore helper.
 */

import {stableStringify} from '@faims3/data-model';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {config} from '@/constants';
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
  isStoredDraftStaleVsLive,
  isUnpublishedDraft,
  setDraft,
  type DraftWriteResult,
} from './draftStorage';
import {hydrateExportedNotebook} from './notebookAdapters';

/** Autosave wait after the last store change that can appear in published JSON. */
export const AUTOSAVE_DEBOUNCE_MS = 500;

/** Local-write phase used to derive the toolbar indicator. */
export type DesignerDraftWriteStatus = 'saving' | 'saved' | 'error';

/**
 * Toolbar indicator: hidden until the first edit (`idle`), then local save
 * progress, or `{notebook} published` after a successful in-session publish.
 */
export type DesignerDraftStatus =
  | 'idle'
  | 'saving'
  | 'saved'
  | 'published'
  | 'error';

export type DesignerSessionIdentity = DesignerDraftKey;

/** Identity of the slices that appear in published JSON (not undo stacks). */
function publishedFacingFingerprint(notebook: NotebookWithHistory): unknown[] {
  return [
    notebook.metadata,
    notebook.uiSpec.present,
    notebook.planTemplates,
    notebook.plans,
  ];
}

function samePublishedFacing(
  left: unknown[] | undefined,
  right: unknown[]
): boolean {
  return Boolean(
    left &&
    left.length === right.length &&
    left.every((item, i) => item === right[i])
  );
}

/**
 * Map write status, unpublished compare, and in-session publish onto the
 * toolbar indicator.
 */
export function resolveDesignerDraftDisplayStatus({
  writeStatus,
  isUnpublished,
  hasPublishedThisSession,
}: {
  writeStatus: DesignerDraftWriteStatus;
  isUnpublished: boolean;
  hasPublishedThisSession: boolean;
}): DesignerDraftStatus {
  if (writeStatus === 'saving' || writeStatus === 'error') {
    return writeStatus;
  }
  if (isUnpublished) {
    return 'saved';
  }
  if (hasPublishedThisSession) {
    return 'published';
  }
  return 'idle';
}

/**
 * Status copy for the aria-live region. Uses an ellipsis while a write or
 * debounce is pending. Idle has no copy; the indicator is hidden.
 */
export function designerDraftStatusCopy(
  status: DesignerDraftStatus,
  errorMessage?: string
): string {
  if (status === 'idle') {
    return '';
  }
  if (status === 'saving') {
    return 'Saving draft…';
  }
  if (status === 'error') {
    return errorMessage || "Couldn't save draft";
  }
  if (status === 'published') {
    return `${config.notebookNameCapitalized} published`;
  }
  return 'Saved draft';
}

/**
 * Choose the session notebook: an unpublished stored draft hydrated through
 * the load adapters, or the live server snapshot when none exists.
 */
export function resolveDesignerSessionNotebook({
  identity,
  serverNotebook,
  mode = 'project',
  liveUiSpecHash,
}: {
  identity?: DesignerSessionIdentity;
  serverNotebook?: NotebookWithHistory;
  mode?: DesignerDocumentMode;
  liveUiSpecHash?: string;
}): {
  notebook?: NotebookWithHistory;
  published?: Notebook;
  isStale: boolean;
  publishedHash?: string;
} {
  const livePublished = serverNotebook
    ? toPublishedNotebook(serverNotebook)
    : undefined;
  if (identity) {
    const stored = getDraft(identity);
    if (stored && isUnpublishedDraft(stored.draft, stored.published)) {
      const restored = hydrateExportedNotebook(stored.draft, mode);
      if (restored) {
        return {
          notebook: restored,
          published: stored.published,
          isStale: isStoredDraftStaleVsLive(stored, {
            uiSpecHash: liveUiSpecHash,
          }),
          publishedHash: stored.publishedHash,
        };
      }
    }
  }
  return {
    notebook: serverNotebook,
    published: livePublished,
    isStale: false,
    publishedHash: liveUiSpecHash,
  };
}

export type DesignerDraftSession = {
  status: DesignerDraftStatus;
  statusCopy: string;
  errorMessage?: string;
  isUnpublished: boolean;
  isDraftWriteInFlight: boolean;
  isDebouncePending: boolean;
  publishedHash?: string;
  persistDraftNow: () => DraftWriteResult;
  discardDraft: () => void;
  markPublished: (snapshot: Notebook, nextPublishedHash?: string) => void;
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
  publishedHash,
}: {
  store: DesignerStore;
  identity?: DesignerSessionIdentity;
  initialPublished?: Notebook;
  publishedHash?: string;
}): DesignerDraftSession {
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const publishedRef = useRef(initialPublished);
  const publishedHashRef = useRef(publishedHash);
  const discardedRef = useRef(false);
  const flushingRef = useRef(false);
  const lastWrittenRef = useRef(
    stableStringify(toPublishedNotebook(store.getState().notebook))
  );
  const lastFingerprintRef = useRef(
    publishedFacingFingerprint(store.getState().notebook)
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [published, setPublished] = useState(initialPublished);
  const [writeStatus, setWriteStatus] =
    useState<DesignerDraftWriteStatus>('saved');
  const [hasPublishedThisSession, setHasPublishedThisSession] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [debouncePending, setDebouncePending] = useState(false);
  const [writeInFlight, setWriteInFlight] = useState(false);
  const [exportSignature, setExportSignature] = useState(
    lastWrittenRef.current
  );
  const [sessionPublishedHash, setSessionPublishedHash] =
    useState(publishedHash);

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

    lastFingerprintRef.current = publishedFacingFingerprint(
      store.getState().notebook
    );
    const exported = toPublishedNotebook(store.getState().notebook);
    const signature = stableStringify(exported);
    setExportSignature(signature);
    setDebouncePending(false);

    if (signature === lastWrittenRef.current) {
      setWriteStatus('saved');
      setErrorMessage(undefined);
      return {ok: true};
    }

    const currentIdentity = identityRef.current;
    if (!currentIdentity) {
      lastWrittenRef.current = signature;
      setWriteStatus('saved');
      setErrorMessage(undefined);
      return {ok: true};
    }

    const publishedHash = publishedHashRef.current;
    if (!publishedHash) {
      setWriteStatus('error');
      setErrorMessage('The local draft could not be saved.');
      return {ok: false, error: 'The local draft could not be saved.'};
    }

    setWriteInFlight(true);
    const result = setDraft(currentIdentity, {
      draft: exported,
      published: publishedRef.current ?? exported,
      publishedHash,
    });
    setWriteInFlight(false);

    if (result.ok) {
      lastWrittenRef.current = signature;
      setWriteStatus('saved');
      setErrorMessage(undefined);
    } else {
      setWriteStatus('error');
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
    setWriteStatus('saving');
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
    publishedHashRef.current = publishedHash;
    setSessionPublishedHash(publishedHash);
    setPublished(initialPublished);
    const signature = stableStringify(
      toPublishedNotebook(store.getState().notebook)
    );
    lastWrittenRef.current = signature;
    lastFingerprintRef.current = publishedFacingFingerprint(
      store.getState().notebook
    );
    setExportSignature(signature);
    setWriteStatus('saved');
    setHasPublishedThisSession(false);
    setErrorMessage(undefined);
    setDebouncePending(false);
    setWriteInFlight(false);

    const unsubscribe = store.subscribe(() => {
      if (flushingRef.current || discardedRef.current) {
        return;
      }
      const nextFingerprint = publishedFacingFingerprint(
        store.getState().notebook
      );
      if (samePublishedFacing(lastFingerprintRef.current, nextFingerprint)) {
        return;
      }
      lastFingerprintRef.current = nextFingerprint;
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

  const markPublished = useCallback(
    (snapshot: Notebook, nextPublishedHash?: string) => {
      publishedRef.current = snapshot;
      setPublished(snapshot);
      if (nextPublishedHash) {
        publishedHashRef.current = nextPublishedHash;
        setSessionPublishedHash(nextPublishedHash);
      }
      const signature = stableStringify(snapshot);
      lastWrittenRef.current = signature;
      setExportSignature(signature);
      setWriteStatus('saved');
      setHasPublishedThisSession(true);
      setErrorMessage(undefined);
    },
    []
  );

  const publishedSignature = useMemo(
    () => (published ? stableStringify(published) : undefined),
    [published]
  );
  const isUnpublished = Boolean(
    debouncePending ||
    (publishedSignature && exportSignature !== publishedSignature)
  );
  const status = resolveDesignerDraftDisplayStatus({
    writeStatus,
    isUnpublished,
    hasPublishedThisSession,
  });

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
    publishedHash: sessionPublishedHash,
  };
}
