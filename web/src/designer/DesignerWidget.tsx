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
import {
  createMemoryRouter,
  RouterProvider,
  RouteObject,
  Navigate,
} from 'react-router-dom';
import {migrateNotebook} from '@faims3/data-model';

import {createDesignerStore} from './createDesignerStore';
import globalTheme from './theme';
import type {Notebook, NotebookWithHistory} from './state/initial';
import {stripDesignerIdentifiers, toNotebook} from './domain/notebook/adapters';

import {NotebookEditor} from './components/notebook-editor';
import {InfoPanel} from './components/info-panel';
import {DesignPanel} from './components/design-panel';

import {v4 as uuidv4} from 'uuid';

/**
 * @file Full-screen designer shell: migrate notebook, Redux, memory router, export without internal ids.
 */

/** Props for the full-screen notebook designer embedded in the main app. */
export interface DesignerWidgetProps {
  /** Initial notebook; undefined shows empty state until parent supplies data. */
  notebook?: NotebookWithHistory;
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
 * Standalone designer shell: migrates notebook data, mounts Redux + router, and
 * serialises without `designerIdentifier` on save.
 */
export function DesignerWidget({
  notebook,
  onClose,
  themeOverride,
  debug = false,
  loadingDuration = 1000,
  animationDuration = 300,
  animationScale = 0.95,
}: DesignerWidgetProps) {
  // 1. Migrate + inject designerIdentifiers + reset undo history on each new notebook
  const processedNotebook = useMemo<NotebookWithHistory | undefined>(() => {
    // check that we have an actual notebook
    if (!notebook?.metadata) return undefined;

    const flat: Notebook = {
      metadata: notebook.metadata,
      'ui-specification': notebook['ui-specification'].present,
    };
    // migrate the notebook - update any out of date fields or structures
    const {migrated} = migrateNotebook(flat);
    const migratedUiSpec = migrated[
      'ui-specification'
    ] as Notebook['ui-specification'];
    const migratedMetadata = migrated.metadata as Notebook['metadata'];

    // Inject in-memory designerIdentifier if missing
    Object.values(migratedUiSpec.fields).forEach(field => {
      if (!field.designerIdentifier) {
        field.designerIdentifier = uuidv4();
      }
    });

    return {
      metadata: migratedMetadata,
      'ui-specification': {
        present: migratedUiSpec,
        past: [],
        future: [],
      },
    };
  }, [notebook]);

  // 2. Create a fresh Redux store whenever processedNotebook or debug flag changes
  const store = useMemo(
    () => createDesignerStore(processedNotebook, debug),
    [processedNotebook, debug]
  );

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
      return themeOverride(globalTheme);
    }
    return {...globalTheme, ...themeOverride};
  }, [themeOverride]);

  const doClose = useCallback(
    (file: File | undefined) => onClose(file),
    [onClose]
  );

  /** Serialise present notebook, strip internal ids, and return a downloadable JSON `File`. */
  const handleDone = useCallback(() => {
    const actualNotebook: Notebook = toNotebook(store.getState().notebook);

    // Remove internal IDs before serialisation
    const exportNotebook = stripDesignerIdentifiers(actualNotebook);

    const blob = new Blob([JSON.stringify(exportNotebook, null, 2)], {
      type: 'application/json',
    });
    const filename =
      String(exportNotebook.metadata.name ?? 'notebook').replace(/\s+/g, '_') +
      '.json';
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
    [notebook, routes]
  );

  if (loading) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        height="100%"
        width="100%"
      >
        <Typography variant="h4" fontWeight="bold" sx={{mb: 2}}>
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
              <Typography variant="h6" fontWeight="bold">
                Notebook Editor
              </Typography>
            </Toolbar>
          </AppBar>

          <Dialog
            open={cancelDialogOpen}
            onClose={() => setCancelDialogOpen(false)}
            TransitionComponent={Grow}
            transitionDuration={animationDuration}
            aria-labelledby="cancel-dialog-title"
            aria-describedby="cancel-dialog-description"
            PaperProps={{sx: {transformOrigin: 'top center'}}}
          >
            <DialogTitle id="cancel-dialog-title">
              Are you sure you want to cancel?
            </DialogTitle>
            <DialogContent>
              <DialogContentText id="cancel-dialog-description">
                Any changes you’ve made will be lost. If you’re sure, hit “Yes,
                cancel”. Otherwise, choose “No, keep editing”.
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

          <Box flexGrow={1} minHeight={0} sx={{overflow: 'auto'}}>
            <RouterProvider router={memoryRouterInstance} />
          </Box>
        </Box>
      </ThemeProvider>
    </ReduxProvider>
  );
}
