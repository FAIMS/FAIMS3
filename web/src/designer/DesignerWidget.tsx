// SPDX-License-Identifier: Apache-2.0

import React, {useMemo, useState, useEffect, useCallback, useRef} from 'react';
import {Provider as ReduxProvider} from 'react-redux';
import {
  ThemeProvider,
  ScopedCssBaseline,
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
import {DesignerChromeProvider} from './state/designer-chrome-context';
import {DesignerEditingProvider} from './state/editing-context';
import {InfoPanel} from './components/info-panel';
import {DesignPanel} from './components/design-panel';
import {SetupFormPanel} from './components/setup-form-panel';
import {config} from '@/constants';
import type {DesignerResourceKind} from './integration/draftStorage';
import {
  type DesignerPublishIntent,
  DesignerPublishDialog,
} from './components/designer-publish-dialog';
import {DesignerCloseDraftDialog} from './components/designer-close-draft-dialog';
import {DesignerDraftStatusLabel} from './components/designer-draft-status';
import {
  resolveDesignerSessionNotebook,
  useDesignerDraftSession,
} from './integration/useDesignerDraftSession';

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
   * Autosave never calls this.
   */
  publishNotebook?: (file: File) => Promise<unknown>;
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
  if (identityKeyRef.current !== notebookIdentity) {
    identityKeyRef.current = notebookIdentity;
    serverNotebookRef.current = notebook;
  }

  const session = useMemo(() => {
    const resolved = resolveDesignerSessionNotebook({
      identity,
      serverNotebook: serverNotebookRef.current,
      mode: designerMode,
    });
    return {
      notebook: withDesignerIdentifiers(resolved.notebook),
      published: resolved.published,
    };
    // Restore once per host resource; do not re-run on a same-session refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notebookIdentity, designerMode]);

  const processedNotebook = session.notebook;

  const [store, setStore] = useState(() =>
    createDesignerStore(processedNotebook, debug, designerMode)
  );

  useEffect(() => {
    setStore(createDesignerStore(processedNotebook, debug, designerMode));
  }, [notebookIdentity, debug, designerMode]);

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
  });

  const [loading, setLoading] = useState(true);
  const [animateIn, setAnimateIn] = useState(false);
  const [animateOut, setAnimateOut] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [publishIntent, setPublishIntent] =
    useState<DesignerPublishIntent | null>(null);
  const [publishing, setPublishing] = useState(false);

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
      await publishNotebook(notebookJsonFile(exported, exportBaseName));
      draftSession.markPublished(exported);
      draftSession.persistDraftNow();
      setPublishIntent(null);
      if (intent === 'close') {
        closeOverlay(undefined);
      }
    } catch {
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

  const chromeValue = useMemo(
    () => ({
      onPublish: () => handlePublishRequest('stay'),
      onPublishAndClose: () => handlePublishRequest('close'),
      onCancelRequest: requestClose,
      publishDisabled: !draftSession.isUnpublished || publishing,
    }),
    [draftSession.isUnpublished, handlePublishRequest, publishing, requestClose]
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
      <DesignerChromeProvider value={chromeValue}>
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
                  <Box sx={{display: 'flex', alignItems: 'center', gap: 2}}>
                    <DesignerDraftStatusLabel
                      status={draftSession.status}
                      errorMessage={draftSession.errorMessage}
                    />
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
                  </Box>
                </Toolbar>
              </AppBar>

              <DesignerCloseDraftDialog
                open={closeDialogOpen}
                animationDuration={animationDuration}
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
                onCancel={() => setPublishIntent(null)}
                onConfirm={() => {
                  void handlePublishConfirm();
                }}
              />

              <Box sx={{flexGrow: 1, minHeight: 0, overflow: 'auto'}}>
                <RouterProvider router={memoryRouterInstance} />
              </Box>
            </Box>
          </ThemeProvider>
        </DesignerEditingProvider>
      </DesignerChromeProvider>
    </ReduxProvider>
  );
}
