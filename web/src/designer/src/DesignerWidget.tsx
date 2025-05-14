import {useMemo, useState} from 'react';
import {Provider as ReduxProvider} from 'react-redux';
import {
  ThemeProvider,
  CssBaseline,
  Box,
  Button,
  Typography,
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

import {NotebookEditor} from './components/notebook-editor';
import {InfoPanel} from './components/info-panel';
import {DesignPanel} from './components/design-panel';

export interface DesignerWidgetProps {
  notebook?: NotebookWithHistory;
  onClose: (notebookJsonFile: File) => void;
  themeOverride?: Parameters<typeof ThemeProvider>[0]['theme'];
  debug?: boolean;
}

export function DesignerWidget({
  notebook,
  onClose,
  themeOverride,
  debug = false,
}: DesignerWidgetProps) {
  const store = useMemo(() => createDesignerStore(notebook), [notebook, debug]);

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

    onClose(file);
  };

  const mergedTheme = useMemo(() => {
    if (typeof themeOverride === 'function') {
      return themeOverride(globalTheme);
    }
    return {...globalTheme, ...themeOverride};
  }, [themeOverride]);

  const routes: RouteObject[] = useMemo(
    () => [
      {
        path: '/',
        element: <NotebookEditor />,
        children: [
          {index: true, element: <Navigate to="/design/0" replace />},

          {path: 'info', element: <InfoPanel />},
          {
            path: 'design/*',
            element: <DesignPanel />,
          },
        ],
      },
    ],
    []
  );

  const [memoryRouterInstance] = useState(() =>
    createMemoryRouter(routes, {
      initialEntries: ['/design/0'],
    })
  );

  return (
    <ReduxProvider store={store}>
      <ThemeProvider theme={mergedTheme}>
        <CssBaseline />
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
            <Button variant="contained" onClick={handleDone}>
              Done
            </Button>
          </Box>
          <Box flexGrow={1} minHeight={0} sx={{overflow: 'auto'}}>
            <RouterProvider router={memoryRouterInstance} />
          </Box>
        </Box>
        )
      </ThemeProvider>
    </ReduxProvider>
  );
}
