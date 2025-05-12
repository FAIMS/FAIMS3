import {useMemo, useEffect} from 'react';
import {Provider as ReduxProvider} from 'react-redux';
import {
  ThemeProvider,
  CssBaseline,
  Box,
  Button,
  Typography,
} from '@mui/material';
import {
  createBrowserRouter,
  createMemoryRouter,
  RouterProvider,
  RouteObject,
} from 'react-router-dom';

import {createDesignerStore} from './createDesignerStore';
import globalTheme from './theme';
import type {NotebookWithHistory} from './state/initial';

import {NotebookEditor} from './components/notebook-editor';
import {NotebookLoader} from './components/notebook-loader';
import {InfoPanel} from './components/info-panel';
import {DesignPanel} from './components/design-panel';
import {ReviewPanel} from './components/review-panel';

export interface DesignerWidgetProps {
  notebook?: NotebookWithHistory;
  onChange?: (nb: NotebookWithHistory) => void;
  onClose?: () => void;
  themeOverride?: Parameters<typeof ThemeProvider>[0]['theme'];
  debug?: boolean;
}

export function DesignerWidget({
  notebook,
  onChange,
  onClose,
  themeOverride,
  debug = false,
}: DesignerWidgetProps) {
  const store = useMemo(() => createDesignerStore(notebook), [notebook, debug]);

  useEffect(() => {
    if (!onChange) return;
    const unsub = store.subscribe(() => {
      const {modified, notebook: nbState} = store.getState();
      if (modified) onChange(nbState);
    });
    return unsub;
  }, [store, onChange]);

  const mergedTheme = useMemo(() => {
    if (typeof themeOverride === 'function') {
      return themeOverride(globalTheme);
    }
    return {...globalTheme, ...themeOverride};
  }, [themeOverride]);

  const routes: RouteObject[] = [
    {
      path: '/',
      element: <NotebookEditor />,
      children: [
        {index: true, element: <NotebookLoader />},
        {path: 'info', element: <InfoPanel />},
        {path: 'design/*', element: <DesignPanel />},
        {path: 'export', element: <ReviewPanel />},
      ],
    },
  ];

  const browserRouter = useMemo(() => createBrowserRouter(routes), []);
  const memoryRouter = useMemo(
    () =>
      createMemoryRouter(routes, {
        initialEntries: ['/design'],
      }),
    []
  );

  return (
    <ReduxProvider store={store}>
      <ThemeProvider theme={mergedTheme}>
        <CssBaseline />

        {onClose ? (
          <Box display="flex" flexDirection="column" height="100%">
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              p={2}
              borderBottom={1}
              borderColor="divider"
            >
              <Typography variant="subtitle1">Designer</Typography>
              <Button variant="contained" onClick={onClose}>
                Done
              </Button>
            </Box>

            <Box flexGrow={1} minHeight={0} sx={{overflow: 'auto'}}>
              <RouterProvider router={memoryRouter} />
            </Box>
          </Box>
        ) : (
          <RouterProvider router={browserRouter} />
        )}
      </ThemeProvider>
    </ReduxProvider>
  );
}
