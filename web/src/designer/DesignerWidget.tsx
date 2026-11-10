// SPDX-License-Identifier: Apache-2.0

import React, {useMemo, useState, useEffect, useCallback, useRef} from 'react';
import {Provider as ReduxProvider} from 'react-redux';
import {
  ThemeProvider,
  ScopedCssBaseline,
  Alert,
  Box,
  IconButton,
  Typography,
  AppBar,
  Toolbar,
  CircularProgress,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import {
  createMemoryRouter,
  RouterProvider,
  RouteObject,
  Navigate,
} from 'react-router-dom';
import {createDesignerStore} from './createDesignerStore';
import {createDesignerTheme} from './theme';
import type {
  DesignerDocumentMode,
  Notebook,
  NotebookWithHistory,
} from './state/initial';
import {slugify} from './domain/notebook/ids';
import {THEME} from '../lib/theme';
import {NotebookEditor} from './components/notebook-editor';
import {DesignerActionsProvider} from './state/designer-actions-context';
import {DesignerEditingProvider} from './state/editing-context';
import {InfoPanel} from './components/info-panel';
import {DesignPanel} from './components/design-panel';
import {SetupFormPanel} from './components/setup-form-panel';
import {config} from '@/constants';
import {downloadFile} from '@/lib/utils';
import {
  discardDraft,
  type DesignerResourceKind,
} from './integration/draftStorage';
import {
  type DesignerPublishIntent,
  DesignerPublishDialog,
} from './components/designer-publish-dialog';
import {DesignerCloseDraftDialog} from './components/designer-close-draft-dialog';
import {DesignerPublishConflictDialog} from './components/designer-publish-conflict-dialog';
import {DesignerStaleDraftDialog} from './components/designer-stale-draft-dialog';
import {
  resolveDesignerSessionNotebook,
  useDesignerDraftSession,
} from './integration/useDesignerDraftSession';
import {DesignerUiSpecConflictError} from './integration/useDesignerSaveMutation';

/**
 * @file Full-screen designer shell: hydrate notebook, Redux, memory router, local drafts, publish.
 */

/** Props for the full-screen notebook designer embedded in the main app. */
export interface DesignerWidgetProps {
  /** Initial notebook; undefined shows empty state until parent supplies data. */
  notebook?: NotebookWithHistory;
  /** Whether this session edits a notebook or a template (templates may carry plan templates). */
  designerMode?: DesignerDocumentMode;
  /** Used for the exported JSON filename (survey/template display name). */
  exportBaseName?: string;
  /**
   * Records already collected. Omit for templates.
   * Field delete warns when this is greater than 0 and the field existed at open.
   */
  existingRecordCount?: number;
  /** Called when the overlay should close. Publish is in-editor; this is not a PUT. */
  onClose: (notebookJsonFile: File | undefined) => void;
  /** Optional MUI theme merge or factory `(base) => theme` for host branding. */
  themeOverride?: Parameters<typeof ThemeProvider>[0]['theme'];
  /** Log Redux actions to the console. */
  debug?: boolean;
  /** Milliseconds to show the loading spinner before revealing the editor shell. */
  loadingDuration?: number;
  /** Fade/scale transition duration for enter and exit (ms). */
  animationDuration?: number;
  /** Scale factor when hidden (`scale(animationScale)` before fade-in). */
  animationScale?: number;
  /** Signed-in user id (`user.user.id`) for origin-private draft keys. */
  userId?: string;
  /** Resource collection; a project draft must not load as a template. */
  resourceKind?: DesignerResourceKind;
  /** Project or template id. */
  resourceId?: string;
  /**
   * Host `useDesignerSaveMutation().mutateAsyncWithToast`. Runs the live PUT.
   * Autosave never calls this. Pass `ifMatch` (uiSpec hash) for a conditional
   * write; omit it only for confirmed overwrite after a 409.
   */
  publishNotebook?: (
    file: File,
    options?: {ifMatch?: string}
  ) => Promise<unknown>;
  /**
   * `uiSpecProperties.hash` of the live design at open. Used for If-Match and
   * stale-draft detection. Pinned by the host overlay for the session.
   */
  liveUiSpecHash?: string;
}

function uiSpecHashFromPublishResult(result: unknown): string | undefined {
  if (!result || typeof result !== 'object') {
    return undefined;
  }
  const hash = (result as {uiSpecProperties?: {hash?: unknown}})
    .uiSpecProperties?.hash;
  return typeof hash === 'string' && hash.length === 64 ? hash : undefined;
}

/** Inject in-memory designerIdentifiers and reset undo stacks for a session. */
function withDesignerIdentifiers(
  notebook?: NotebookWithHistory
): NotebookWithHistory | undefined {
  if (!notebook?.metadata?.information || !notebook.uiSpec?.present) {
    return undefined;
  }

  const present = structuredClone(notebook.uiSpec.present);

  Object.values(present.fields).forEach(field => {
    if (!field.designerIdentifier) {
      field.designerIdentifier = crypto.randomUUID();
    }
  });

  return {
    metadata: notebook.metadata,
    uiSpec: {
      present,
      past: [],
      future: [],
    },
    planTemplates: notebook.planTemplates ?? [],
    plans: notebook.plans ?? [],
  };
}

function notebookJsonFile(exported: Notebook, exportBaseName?: string): File {
  const json = JSON.stringify(exported, null, 2);
  const filename = `${slugify(String(exportBaseName ?? 'notebook')) || 'notebook'}.json`;
  return new File([json], filename, {
    type: 'application/json',
  });
}

/**
 * Standalone designer shell: hydrates notebook data, mounts Redux + router, and
 * serialises without `designerIdentifier` on publish.
 */
export function DesignerWidget({
  notebook,
  designerMode = 'project',
  exportBaseName,
  existingRecordCount,
  onClose,
  themeOverride,
  debug = false,
  loadingDuration = 1000,
  animationDuration = 300,
  animationScale = 0.95,
  userId,
  resourceKind,
  resourceId,
  publishNotebook,
  liveUiSpecHash,
}: DesignerWidgetProps) {
  const baseTheme = useMemo(() => createDesignerTheme(THEME), []);
  const identity =
    userId && resourceKind && resourceId
      ? {userId, resourceKind, resourceId}
      : undefined;
  const notebookIdentity = identity
    ? `${identity.userId}:${identity.resourceKind}:${identity.resourceId}`
    : (notebook?.metadata?.custom?.project_id ?? '__none__');

  const identityKeyRef = useRef(notebookIdentity);
  const serverNotebookRef = useRef(notebook);
  const liveHashRef = useRef(liveUiSpecHash);
  if (identityKeyRef.current !== notebookIdentity) {
    identityKeyRef.current = notebookIdentity;
    serverNotebookRef.current = notebook;
    liveHashRef.current = liveUiSpecHash;
  } else if (!liveHashRef.current && liveUiSpecHash) {
    liveHashRef.current = liveUiSpecHash;
  }

  const [loadLiveForIdentity, setLoadLiveForIdentity] = useState<string | null>(
    null
  );
  const [staleAckForIdentity, setStaleAckForIdentity] = useState<string | null>(
    null
  );
  const forceLive = loadLiveForIdentity === notebookIdentity;
  const staleAcknowledged = staleAckForIdentity === notebookIdentity;

  const session = useMemo(() => {
    const resolved = resolveDesignerSessionNotebook({
      identity: forceLive ? undefined : identity,
      serverNotebook: serverNotebookRef.current,
      mode: designerMode,
      liveUiSpecHash: liveHashRef.current,
    });
    return {
      notebook: withDesignerIdentifiers(resolved.notebook),
      published: resolved.published,
      isStale: forceLive ? false : resolved.isStale,
      publishedHash: resolved.publishedHash,
    };
    // Restore once per host resource; do not re-run on a same-session refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notebookIdentity, designerMode, forceLive]);

  const processedNotebook = session.notebook;

  const [store, setStore] = useState(() =>
    createDesignerStore(processedNotebook, debug, designerMode)
  );

  useEffect(() => {
    setStore(createDesignerStore(processedNotebook, debug, designerMode));
  }, [notebookIdentity, debug, designerMode, forceLive]);

  const originalFieldIdentifiers = useMemo(
    () =>
      new Set(
        Object.values(store.getState().notebook.uiSpec.present.fields)
          .map(field => field.designerIdentifier)
          .filter((id): id is string => Boolean(id))
      ),
    [store]
  );

  const editingContextValue = useMemo(
    () => ({existingRecordCount, originalFieldIdentifiers}),
    [existingRecordCount, originalFieldIdentifiers]
  );

  const draftSession = useDesignerDraftSession({
    store,
    identity,
    initialPublished: session.published,
    publishedHash: session.publishedHash,
  });

  const [loading, setLoading] = useState(true);
  const [animateIn, setAnimateIn] = useState(false);
  const [animateOut, setAnimateOut] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [publishIntent, setPublishIntent] =
    useState<DesignerPublishIntent | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(false);
      window.setTimeout(() => setAnimateIn(true), 50);
    }, loadingDuration);
    return () => window.clearTimeout(timer);
  }, [loadingDuration]);

  const mergedTheme = useMemo(() => {
    if (typeof themeOverride === 'function') {
      return themeOverride(baseTheme);
    }
    return {...baseTheme, ...themeOverride};
  }, [baseTheme, themeOverride]);

  const doClose = useCallback(
    (file: File | undefined) => onClose(file),
    [onClose]
  );

  const closeOverlay = useCallback(
    (file: File | undefined) => {
      setCloseDialogOpen(false);
      setPublishIntent(null);
      setAnimateOut(true);
      setAnimateIn(false);
      window.setTimeout(() => doClose(file), animationDuration);
    },
    [animationDuration, doClose]
  );

  const unpublishedOrWriting =
    draftSession.isUnpublished ||
    draftSession.isDebouncePending ||
    draftSession.isDraftWriteInFlight;

  const requestClose = useCallback(() => {
    if (unpublishedOrWriting) {
      setCloseDialogOpen(true);
      return;
    }
    closeOverlay(undefined);
  }, [closeOverlay, unpublishedOrWriting]);

  const handleCloseKeepDraft = useCallback(() => {
    draftSession.persistDraftNow();
    closeOverlay(undefined);
  }, [closeOverlay, draftSession]);

  const handleDiscardDraft = useCallback(() => {
    draftSession.discardDraft();
    closeOverlay(undefined);
  }, [closeOverlay, draftSession]);

  const handleWorkOnMyVersion = useCallback(() => {
    setStaleAckForIdentity(notebookIdentity);
  }, [notebookIdentity]);

  const handleDiscardStaleAndLoadLive = useCallback(() => {
    setConflictOpen(false);
    draftSession.discardDraft();
    if (identity) {
      discardDraft(identity);
    }
    setLoadLiveForIdentity(notebookIdentity);
    setStaleAckForIdentity(notebookIdentity);
  }, [draftSession, identity, notebookIdentity]);

  const handleDownloadDraftBackup = useCallback(() => {
    const exported = draftSession.exportPresentNotebook();
    const json = JSON.stringify(exported, null, 2);
    const base = slugify(String(exportBaseName ?? 'notebook')) || 'notebook';
    void downloadFile(
      new Blob([json], {type: 'application/json'}),
      `${base}-draft-backup.json`
    );
  }, [draftSession, exportBaseName]);

  const handlePublishRequest = useCallback(
    (intent: DesignerPublishIntent) => {
      if (!draftSession.isUnpublished) {
        if (intent === 'close') {
          closeOverlay(undefined);
        }
        return;
      }
      setPublishIntent(intent);
    },
    [closeOverlay, draftSession.isUnpublished]
  );

  const handlePublishConfirm = useCallback(async () => {
    const intent = publishIntent;
    const exported = draftSession.exportPresentNotebook();
    if (!publishNotebook) {
      setPublishIntent(null);
      if (intent === 'close') {
        closeOverlay(undefined);
      }
      return;
    }
    setPublishing(true);
    try {
      const file = notebookJsonFile(exported, exportBaseName);
      const result = await publishNotebook(file, {
        ifMatch: draftSession.publishedHash,
      });
      draftSession.markPublished(exported, uiSpecHashFromPublishResult(result));
      draftSession.persistDraftNow();
      setPublishIntent(null);
      setConflictOpen(false);
      if (intent === 'close') {
        closeOverlay(undefined);
      }
    } catch (error) {
      if (error instanceof DesignerUiSpecConflictError) {
        setPublishIntent(null);
        setConflictOpen(true);
        return;
      }
      // Host toast (Download JSON) already ran; keep the overlay and draft.
    } finally {
      setPublishing(false);
    }
  }, [
    closeOverlay,
    draftSession,
    exportBaseName,
    publishIntent,
    publishNotebook,
  ]);

  const handleOverwriteLiveDesign = useCallback(async () => {
    const exported = draftSession.exportPresentNotebook();
    if (!publishNotebook) {
      setConflictOpen(false);
      return;
    }
    setPublishing(true);
    try {
      const result = await publishNotebook(
        notebookJsonFile(exported, exportBaseName)
      );
      draftSession.markPublished(exported, uiSpecHashFromPublishResult(result));
      draftSession.persistDraftNow();
      setConflictOpen(false);
    } catch {
      // Host toast already ran; keep the overlay and draft.
    } finally {
      setPublishing(false);
    }
  }, [draftSession, exportBaseName, publishNotebook]);

  useEffect(() => {
    if (!unpublishedOrWriting) {
      return;
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [unpublishedOrWriting]);

  const designerActions = useMemo(
    () => ({
      onPublish: () => handlePublishRequest('stay'),
      onPublishAndClose: () => handlePublishRequest('close'),
      onCancelRequest: requestClose,
      publishDisabled: !draftSession.isUnpublished || publishing,
      draftStatus: draftSession.status,
      draftErrorMessage: draftSession.errorMessage,
    }),
    [
      draftSession.errorMessage,
      draftSession.isUnpublished,
      draftSession.status,
      handlePublishRequest,
      publishing,
      requestClose,
    ]
  );

  const routes: RouteObject[] = useMemo(
    () => [
      {
        path: '/',
        element: <NotebookEditor />,
        children: [
          {index: true, element: <Navigate to="/design/0" replace />},
          {path: 'info', element: <InfoPanel />},
          {path: 'setup', element: <SetupFormPanel />},
          {path: 'design/*', element: <DesignPanel />},
        ],
      },
    ],
    []
  );

  const memoryRouterInstance = useMemo(
    () => createMemoryRouter(routes, {initialEntries: ['/design/0']}),
    [notebookIdentity, routes]
  );

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          width: '100%',
        }}
      >
        <Typography variant="h4" sx={{mb: 2, fontWeight: 'bold'}}>
          {config.notebookNameCapitalized} Editor
        </Typography>
        <CircularProgress sx={{color: '#669911'}} />
      </Box>
    );
  }

  const isVisible = animateIn && !animateOut;

  return (
    <ReduxProvider store={store}>
      <DesignerActionsProvider value={designerActions}>
        <DesignerEditingProvider value={editingContextValue}>
          <ThemeProvider theme={mergedTheme}>
            <ScopedCssBaseline />
            <Box
              data-testid="web-designer-shell"
              sx={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'scale(1)' : `scale(${animationScale})`,
                transition: `opacity ${animationDuration}ms ease, transform ${animationDuration}ms ease`,
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
              }}
            >
              <AppBar position="static" color="default" elevation={1}>
                <Toolbar sx={{justifyContent: 'space-between', gap: 2}}>
                  <Typography variant="h6" sx={{fontWeight: 'bold'}}>
                    {config.notebookNameCapitalized} Editor
                  </Typography>
                  <IconButton
                    aria-label="close designer"
                    data-testid="web-designer-close-button"
                    onClick={requestClose}
                    size="small"
                    sx={{
                      color: 'text.secondary',
                      '&:hover': {color: 'text.primary'},
                    }}
                  >
                    <CloseRoundedIcon />
                  </IconButton>
                </Toolbar>
              </AppBar>

              {session.isStale && staleAcknowledged && !forceLive ? (
                <Alert
                  severity="warning"
                  data-testid="web-designer-stale-draft-banner"
                  sx={{borderRadius: 0}}
                >
                  You are working on a stale draft. Saving will overwrite the
                  latest version.
                </Alert>
              ) : null}

              <DesignerStaleDraftDialog
                open={
                  !loading &&
                  session.isStale &&
                  !staleAcknowledged &&
                  !forceLive
                }
                animationDuration={animationDuration}
                onDismiss={handleCloseKeepDraft}
                onSwitchToLatest={handleDiscardStaleAndLoadLive}
                onWorkOnMyVersion={handleWorkOnMyVersion}
                onDownloadBackup={handleDownloadDraftBackup}
              />

              <DesignerCloseDraftDialog
                open={closeDialogOpen}
                animationDuration={animationDuration}
                onPublishNow={() => {
                  setCloseDialogOpen(false);
                  handlePublishRequest('stay');
                }}
                onKeepEditing={() => setCloseDialogOpen(false)}
                onCloseKeepDraft={handleCloseKeepDraft}
                onDiscardDraft={handleDiscardDraft}
              />

              <DesignerPublishDialog
                open={publishIntent !== null}
                mode={designerMode}
                intent={publishIntent}
                busy={publishing}
                animationDuration={animationDuration}
                existingRecordCount={existingRecordCount}
                stale={session.isStale}
                onCancel={() => setPublishIntent(null)}
                onConfirm={() => {
                  void handlePublishConfirm();
                }}
              />

              <DesignerPublishConflictDialog
                open={conflictOpen}
                busy={publishing}
                animationDuration={animationDuration}
                onDismiss={() => setConflictOpen(false)}
                onSwitchToLatest={handleDiscardStaleAndLoadLive}
                onForcePublish={() => {
                  void handleOverwriteLiveDesign();
                }}
                onDownloadBackup={handleDownloadDraftBackup}
              />

              <Box sx={{flexGrow: 1, minHeight: 0, overflow: 'auto'}}>
                <RouterProvider router={memoryRouterInstance} />
              </Box>
            </Box>
          </ThemeProvider>
        </DesignerEditingProvider>
      </DesignerActionsProvider>
    </ReduxProvider>
  );
}
