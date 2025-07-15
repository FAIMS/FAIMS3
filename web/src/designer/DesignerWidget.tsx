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

import React, {useMemo, useState, useEffect} from 'react';
import {Provider as ReduxProvider} from 'react-redux';
import {
  ThemeProvider,
  ScopedCssBaseline,
  Box,
  Button,
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

import {createDesignerStore} from './createDesignerStore';
import globalTheme from './theme';
import type {Notebook, NotebookWithHistory} from './state/initial';
import {migrateNotebook} from './state/migrateNotebook';

import {NotebookEditor} from './components/notebook-editor';
import {InfoPanel} from './components/info-panel';
import {DesignPanel} from './components/design-panel';

import {v4 as uuidv4} from 'uuid';

export interface DesignerWidgetProps {
  notebook?: NotebookWithHistory;
  onClose: (notebookJsonFile: File | undefined) => void;
  themeOverride?: Parameters<typeof ThemeProvider>[0]['theme'];
  debug?: boolean;
  loadingDuration?: number;
  animationDuration?: number;
  animationScale?: number;
}

/**
 * Remove designerIdentifier keys just before export,
 * so the external schema remains clean.
 */
const stripDesignerIdentifiers = (notebook: Notebook): Notebook => {
  const clone = JSON.parse(JSON.stringify(notebook)) as Notebook;
  const fields = clone['ui-specification']?.fields ?? {};
  Object.keys(fields).forEach(fieldName => {
    delete fields[fieldName].designerIdentifier;
  });
  return clone;
};

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
    if (!notebook) return undefined;

    const flat: Notebook = {
      metadata: notebook.metadata,
      'ui-specification': notebook['ui-specification'].present,
    };

    const migrated: Notebook = migrateNotebook(flat);

    // Inject in-memory designerIdentifier if missing
    Object.values(migrated['ui-specification'].fields).forEach(field => {
      if (!field.designerIdentifier) {
        field.designerIdentifier = uuidv4();
      }
    });

    return {
      metadata: migrated.metadata,
      'ui-specification': {
        present: migrated['ui-specification'],
        past: [],
        future: [],
      },
    };
  }, [notebook]);

  // 2. Create a fresh Redux store whenever processedNotebook or debug flag changes
  const store = useMemo(
    () => createDesignerStore(processedNotebook),
    [processedNotebook, debug]
  );

  // 3. Build routes once
  const routes: RouteObject[] = useMemo(
    () => [
      {
        path: '/',
        element: <NotebookEditor />,
        children: [
          {index: true, element: <Navigate to="/design/0" replace />},
          {path: 'info', element: <InfoPanel />},
          {path: 'design/*', element: <DesignPanel />},
        ],
      },
    ],
    []
  );

  // 4. Recreate router on notebook change to wipe any internal routing state
  const memoryRouterInstance = useMemo(
    () => createMemoryRouter(routes, {initialEntries: ['/design/0']}),
    [notebook]
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

  const doClose = (file: File | undefined) => onClose(file);

  const handleDone = () => {
    const {metadata, 'ui-specification': historyState} =
      store.getState().notebook;

    const actualNotebook: Notebook = {
      metadata,
      'ui-specification': historyState.present,
    };

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
  };

  const handleCancel = () => {
    setCancelDialogOpen(false);
    setAnimateOut(true);
    setAnimateIn(false);
    window.setTimeout(() => doClose(undefined), animationDuration);
  };

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
              <Box>
                <Button onClick={() => setCancelDialogOpen(true)} sx={{mr: 1}}>
                  Cancel
                </Button>
                <Button variant="contained" onClick={handleDone}>
                  Save
                </Button>
              </Box>
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
              <Button onClick={() => setCancelDialogOpen(false)} autoFocus>
                No, keep editing
              </Button>
              <Button variant="contained" onClick={handleCancel}>
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
