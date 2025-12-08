/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: App.tsx
 * Description:
 *   TODO
 */

import '@capacitor-community/safe-area';
import {StyledEngineProvider, ThemeProvider} from '@mui/material/styles';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {Route, BrowserRouter as Router, Routes} from 'react-router-dom';
import './App.css';
import {
  ActivePrivateRoute,
  OnlineOnlyRoute,
  TolerantPrivateRoute,
} from './constants/privateRouter';
import * as ROUTES from './constants/routes';
import MainLayout from './gui/layout';
import AboutBuild from './gui/pages/about-build';
import Notebook from './gui/pages/notebook';
import RecordCreate from './gui/pages/record-create';
import {SignIn} from './gui/pages/signin';
import Workspace from './gui/pages/workspace';

// import {unstable_createMuiStrictModeTheme as createMuiTheme} from '@mui/material';
// https://stackoverflow.com/a/64135466/3562777 temporary solution to remove findDOMNode is depreciated in StrictMode warning
// will be resolved in material-ui v5

import {OFFLINE_MAPS} from './buildconfig';
import {NotificationProvider} from './context/popup';
import {InitialiseGate, StateProvider} from './context/store';
import {AuthReturn} from './gui/components/authentication/auth_return';
import {MapDownloadComponent} from './gui/components/map/map-download';
import CreateNewSurvey from './gui/components/workspace/CreateNewSurvey';
import NotFound404 from './gui/pages/404';
import {PouchExplorer} from './gui/pages/pouchExplorer';
import {theme} from './gui/themes';
import {AppUrlListener} from './native_hooks';

import {SafeArea} from '@capacitor-community/safe-area';
import {getEditRecordRoute} from './constants/routes';
import {EditRecordPage} from './gui/pages/newRecord';
import {ViewRecordPage} from './gui/pages/viewRecord';

SafeArea.enable({
  config: {
    customColorsForSystemBars: true,
    statusBarColor: '#FAFAFB', // transparent
    statusBarContent: 'dark',
    navigationBarColor: '#FAFAFB', // transparent
    navigationBarContent: 'dark',
    offset: 0,
  },
});

// type AppProps = {};

// type AppState = {
//   projects: ProjectsList;
//   global_error: null | {};
//   token: boolean;
// };

// Setup react query (prefer to use context provider but can import for legacy class components)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Queries should be enabled by default
      enabled: true,

      // Retry count - try 3 times
      retry: 3,

      // Stale time - this means the cache will be used by default
      staleTime: 30000, // 30s

      // Fetches will occur on remount
      refetchOnMount: true,

      // Fetches will not occur on change of window focus
      refetchOnWindowFocus: false,

      // If we reconnect then fetch again
      refetchOnReconnect: true,
    },
    mutations: {
      // Never retry mutations unless explicit
      retry: 0,
    },
  },
});

export default function App() {
  return (
    <StateProvider>
      <InitialiseGate>
        <NotificationProvider>
          <QueryClientProvider client={queryClient}>
            <StyledEngineProvider injectFirst>
              <ThemeProvider theme={theme}>
                <Router>
                  <AppUrlListener></AppUrlListener>
                  <MainLayout>
                    <Routes>
                      <Route path={ROUTES.SIGN_IN} element={<SignIn />} />
                      <Route
                        path={ROUTES.AUTH_RETURN}
                        element={<AuthReturn />}
                      />
                      <Route
                        path={ROUTES.INDEX}
                        element={
                          <TolerantPrivateRoute>
                            <Workspace />
                          </TolerantPrivateRoute>
                        }
                      />
                      <Route
                        path={`${ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE}:serverId/:projectId`}
                        element={
                          <TolerantPrivateRoute>
                            <Notebook />
                          </TolerantPrivateRoute>
                        }
                      />
                      <Route
                        path={ROUTES.CREATE_NEW_SURVEY}
                        element={
                          // Online only and authenticated
                          <OnlineOnlyRoute>
                            <ActivePrivateRoute>
                              <CreateNewSurvey />
                            </ActivePrivateRoute>
                          </OnlineOnlyRoute>
                        }
                      />

                      <Route
                        path={
                          ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE +
                          ':serverId/' +
                          ':projectId' +
                          ROUTES.RECORD_CREATE +
                          ':typeName'
                        }
                        element={
                          <TolerantPrivateRoute>
                            <RecordCreate />
                          </TolerantPrivateRoute>
                        }
                      />
                      <Route
                        path={getEditRecordRoute({
                          serverId: ':serverId',
                          projectId: ':projectId',
                          recordId: ':recordId',
                        })}
                        element={
                          <TolerantPrivateRoute>
                            <EditRecordPage />
                          </TolerantPrivateRoute>
                        }
                      />
                      <Route
                        path={ROUTES.getViewRecordRoute({
                          serverId: ':serverId',
                          projectId: ':projectId',
                          recordId: ':recordId',
                        })}
                        element={
                          <TolerantPrivateRoute>
                            <ViewRecordPage />
                          </TolerantPrivateRoute>
                        }
                      />

                      <Route path={ROUTES.ABOUT_BUILD} Component={AboutBuild} />
                      {OFFLINE_MAPS && (
                        <Route
                          path={ROUTES.OFFLINE_MAPS}
                          Component={MapDownloadComponent}
                        />
                      )}
                      <Route
                        path={ROUTES.POUCH_EXPLORER}
                        Component={PouchExplorer}
                      />
                      <Route path={'*'} Component={NotFound404} />
                    </Routes>
                  </MainLayout>
                </Router>
              </ThemeProvider>
            </StyledEngineProvider>
          </QueryClientProvider>
        </NotificationProvider>
      </InitialiseGate>
    </StateProvider>
  );
}
