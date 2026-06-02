// Copyright 2023 FAIMS Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import React, {useMemo, useState, useEffect, useCallback} from 'react';
import {Provider as ReduxProvider} from 'react-redux';
import {
  ThemeProvider,
  ScopedCssBaseline,
  Box,
  Button,
  IconButton,
  Typography,
  AppBar,
  Toolbar,
  Dialog,
  Grow,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
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
import type {Notebook, NotebookWithHistory} from './state/initial';
import {stripDesignerIdentifiers, toNotebook} from './domain/notebook/adapters';
import {THEME} from '../lib/theme';
import {NotebookEditor} from './components/notebook-editor';
import {InfoPanel} from './components/info-panel';
import {DesignPanel} from './components/design-panel';

/**
 * @file Full-screen designer shell: hydrate notebook, Redux, memory router, export without internal ids.
 */

/** Props for the full-screen notebook designer embedded in the main app. */
export interface DesignerWidgetProps {
  /** Initial notebook; undefined shows empty state until parent supplies data. */
  notebook?: NotebookWithHistory;
  /** Used for the exported JSON filename (survey/template display name). */
  exportBaseName?: string;
  /** Called with exported JSON `File` on Done, or undefined on cancel. */
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
}

/**
 * Standalone designer shell: hydrates notebook data, mounts Redux + router, and
 * serialises without `designerIdentifier` on save.
 */
export function DesignerWidget({
  notebook,
  exportBaseName,
  onClose,
  themeOverride,
  debug = false,
  loadingDuration = 1000,
  animationDuration = 300,
  animationScale = 0.95,
}: DesignerWidgetProps) {
  const baseTheme = useMemo(() => createDesignerTheme(THEME), []);
  const notebookIdentity = notebook?.metadata?.project_id ?? '__none__';

  // 1. Hydrate + inject designerIdentifiers + reset undo history on each new notebook
  // (schema migration runs in notebookAdapters before the parent passes `notebook` here)

  const processedNotebook = useMemo<NotebookWithHistory | undefined>(() => {
    // check that we have an actual notebook
    if (!notebook?.metadata?.information || !notebook.uiSpec?.present) {
      return undefined;
    }

    const present = structuredClone(notebook.uiSpec.present);

    // Inject in-memory designerIdentifier if missing
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
    };
  }, [notebook]);

  // 2. Keep one Redux store for a notebook identity; do not reset on same-notebook refetch.
  const [store, setStore] = useState(() =>
    createDesignerStore(processedNotebook, debug)
  );

  useEffect(() => {
    setStore(createDesignerStore(processedNotebook, debug));
  }, [notebookIdentity, debug]);

  // Local UI state
  const [loading, setLoading] = useState(true);
  const [animateIn, setAnimateIn] = useState(false);
  const [animateOut, setAnimateOut] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  // Kick off loading animation
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(false);
      window.setTimeout(() => setAnimateIn(true), 50);
    }, loadingDuration);
    return () => window.clearTimeout(timer);
  }, [loadingDuration]);

  // Merge external theme override
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

  /** Serialise present notebook, strip internal ids, and return a downloadable JSON `File`. */
  const handleDone = useCallback(() => {
    const definition: Notebook = toNotebook(store.getState().notebook);

    // Remove internal IDs before serialisation
    const exportNotebook = stripDesignerIdentifiers(definition);

    const blob = new Blob([JSON.stringify(exportNotebook, null, 2)], {
      type: 'application/json',
    });
    const filename =
      String(exportBaseName ?? 'notebook').replace(/\s+/g, '_') + '.json';
    const file = new File([blob], filename, {
      type: 'application/json',
    });

    setAnimateOut(true);
    setAnimateIn(false);
    window.setTimeout(() => doClose(file), animationDuration);
  }, [animationDuration, doClose, store]);

  /** Close without saving after user confirms cancel dialog. */
  const handleCancel = useCallback(() => {
    setCancelDialogOpen(false);
    setAnimateOut(true);
    setAnimateIn(false);
    window.setTimeout(() => doClose(undefined), animationDuration);
  }, [animationDuration, doClose]);

  // 3. Build routes once
  const routes: RouteObject[] = useMemo(
    () => [
      {
        path: '/',
        element: (
          <NotebookEditor
            onSave={handleDone}
            onCancelRequest={() => setCancelDialogOpen(true)}
          />
        ),
        children: [
          {index: true, element: <Navigate to="/design/0" replace />},
          {path: 'info', element: <InfoPanel />},
          {path: 'design/*', element: <DesignPanel />},
        ],
      },
    ],
    [handleDone, setCancelDialogOpen]
  );

  // 4. Recreate router on notebook change to wipe any internal routing state
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
          Notebook Editor
        </Typography>
        <CircularProgress sx={{color: '#669911'}} />
      </Box>
    );
  }

  const isVisible = animateIn && !animateOut;

  return (
    <ReduxProvider store={store}>
      <ThemeProvider theme={mergedTheme}>
        <ScopedCssBaseline />
        <Box
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
            <Toolbar sx={{justifyContent: 'space-between'}}>
              <Typography variant="h6" sx={{fontWeight: 'bold'}}>
                Notebook Editor
              </Typography>
              <IconButton
                aria-label="close designer"
                onClick={() => setCancelDialogOpen(true)}
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

          <Dialog
            open={cancelDialogOpen}
            onClose={() => setCancelDialogOpen(false)}
            slots={{transition: Grow}}
            transitionDuration={animationDuration}
            aria-labelledby="cancel-dialog-title"
            aria-describedby="cancel-dialog-description"
            slotProps={{paper: {sx: {transformOrigin: 'top center'}}}}
          >
            <DialogTitle id="cancel-dialog-title">
              Are you sure you want to cancel?
            </DialogTitle>
            <DialogContent>
              <DialogContentText id="cancel-dialog-description">
                Any changes you've made will be lost. If you're sure, hit "Yes,
                cancel". Otherwise, choose "No, keep editing".
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button
                variant="contained"
                onClick={() => setCancelDialogOpen(false)}
                autoFocus
              >
                No, keep editing
              </Button>
              <Button onClick={handleCancel} color="inherit">
                Yes, cancel
              </Button>
            </DialogActions>
          </Dialog>

          <Box sx={{flexGrow: 1, minHeight: 0, overflow: 'auto'}}>
            <RouterProvider router={memoryRouterInstance} />
          </Box>
        </Box>
      </ThemeProvider>
    </ReduxProvider>
  );
}
