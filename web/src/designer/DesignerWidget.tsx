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

export interface DesignerWidgetProps {
  notebook?: NotebookWithHistory;
  onClose: (notebookJsonFile: File | undefined) => void;
  themeOverride?: Parameters<typeof ThemeProvider>[0]['theme'];
  debug?: boolean;
  loadingDuration?: number;
  animationDuration?: number;
  animationScale?: number;
}

export function DesignerWidget({
  notebook,
  onClose,
  themeOverride,
  debug = false,
  loadingDuration = 1000,
  animationDuration = 300,
  animationScale = 0.95,
}: DesignerWidgetProps) {
  const processedNotebook = useMemo<NotebookWithHistory | undefined>(() => {
    if (!notebook) return undefined;

    const flat: Notebook = {
      metadata: notebook.metadata,
      'ui-specification': notebook['ui-specification'].present,
    };

    const migrated: Notebook = migrateNotebook(flat);

    return {
      metadata: migrated.metadata,
      'ui-specification': {
        present: migrated['ui-specification'],
        past: [],
        future: [],
      },
    };
  }, [notebook]);

  const store = useMemo(
    () => createDesignerStore(processedNotebook),
    [processedNotebook, debug]
  );

  const [loading, setLoading] = useState(true);
  const [animateIn, setAnimateIn] = useState(false);
  const [animateOut, setAnimateOut] = useState(false);

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(false);

      window.setTimeout(() => setAnimateIn(true), 50);
    }, loadingDuration);
    return () => window.clearTimeout(timer);
  }, [loadingDuration]);

  const mergedTheme = useMemo(() => {
    if (typeof themeOverride === 'function') {
      return themeOverride(globalTheme);
    }
    return {...globalTheme, ...themeOverride};
  }, [themeOverride]);

  const doClose = (file: File | undefined) => {
    onClose(file);
  };

  const handleDone = () => {
    const {metadata, 'ui-specification': historyState} =
      store.getState().notebook;

    const actualNotebook: Notebook = {
      metadata,
      'ui-specification': historyState.present,
    };

    const blob = new Blob([JSON.stringify(actualNotebook, null, 2)], {
      type: 'application/json',
    });
    const filename =
      String(actualNotebook.metadata.name ?? 'notebook').replace(/\s+/g, '_') +
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

  const openCancelDialog = () => setCancelDialogOpen(true);
  const closeCancelDialog = () => setCancelDialogOpen(false);

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
  const [memoryRouterInstance] = useState(() =>
    createMemoryRouter(routes, {initialEntries: ['/design/0']})
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
              <Box>
                <Button onClick={openCancelDialog} sx={{mr: 1}}>
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
            onClose={closeCancelDialog}
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
              <Button onClick={closeCancelDialog} autoFocus>
                No, keep editing
              </Button>
              <Button onClick={handleCancel} variant="contained">
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
