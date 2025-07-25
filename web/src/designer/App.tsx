/* eslint-disable n/no-extraneous-import */
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

import './App.css';
import {createBrowserRouter, RouterProvider} from 'react-router-dom';
import {NotebookEditor} from './components/notebook-editor';
import {NotebookLoader} from './components/notebook-loader';
import {InfoPanel} from './components/info-panel';
import {DesignPanel} from './components/design-panel';
import {ReviewPanel} from './components/review-panel';
import {Box, Button, Typography} from '@mui/material';

interface AppProps {
  onClose?: () => void;
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <NotebookEditor />,
    children: [
      {
        index: true,
        element: <NotebookLoader />,
      },
      {
        path: 'info',
        element: <InfoPanel />,
      },
      {
        path: 'design/*',
        element: <DesignPanel />,
      },
      {
        path: 'export',
        element: <ReviewPanel />,
      },
    ],
  },
]);

export default function App({onClose}: AppProps) {
  if (onClose) {
    return (
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

        <Box flexGrow={1} minHeight={0}>
          <NotebookEditor />
        </Box>
      </Box>
    );
  }

  return <RouterProvider router={router} />;
}
