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
import Record from './gui/pages/record';
import RecordCreate from './gui/pages/record-create';
import {SignIn} from './gui/pages/signin';
import Workspace from './gui/pages/workspace';

// import {unstable_createMuiStrictModeTheme as createMuiTheme} from '@mui/material';
// https://stackoverflow.com/a/64135466/3562777 temporary solution to remove findDOMNode is depreciated in StrictMode warning
// will be resolved in material-ui v5

import {NotificationProvider} from './context/popup';
import {ProjectsProvider} from './context/projects-context';
import {AuthReturn} from './gui/components/authentication/auth_return';
import CreateNewSurvey from './gui/components/workspace/CreateNewSurvey';
import NotFound404 from './gui/pages/404';
import {theme} from './gui/themes';
import {AppUrlListener} from './native_hooks';
import {InitialiseGate, StateProvider} from './context/store';
import {MapDownloadComponent} from './gui/components/map/map-download';
import {OFFLINE_MAPS} from './buildconfig';

// type AppProps = {};

// type AppState = {
//   projects: ProjectsList;
//   global_error: null | {};
//   token: boolean;
// };

// Setup react query
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
          <ProjectsProvider>
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
                          path={`${ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE}:project_id`}
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
                        {/* Draft creation happens by redirecting to a fresh minted UUID
                  This is to keep it stable until the user navigates away. So the
                  draft_id is optional, and when RecordCreate is instantiated
                  without one, it immediately mints a UUID and redirects to it */}
                        <Route
                          path={
                            ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE +
                            ':project_id' +
                            ROUTES.RECORD_CREATE +
                            ':type_name' +
                            ROUTES.RECORD_DRAFT +
                            ':draft_id' + //added for keep the record id same for draft
                            ROUTES.RECORD_RECORD +
                            ':record_id'
                          }
                          element={
                            <TolerantPrivateRoute>
                              <RecordCreate />
                            </TolerantPrivateRoute>
                          }
                        />
                        <Route
                          path={
                            ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE +
                            ':project_id' +
                            ROUTES.RECORD_CREATE +
                            ':type_name'
                          }
                          element={
                            <TolerantPrivateRoute>
                              <RecordCreate />
                            </TolerantPrivateRoute>
                          }
                        />
                        {/*Record editing and viewing is a separate affair, separated by
                  the presence/absence of draft_id prop OR draft_id being in the
                  state of the Record component. So if the user clicks a draft to
                  make continued changes, the draft_id is in the URL here.
                  Otherwise, they can make changes to a record they view (Which
                  should at some point, TODO, redirect to the same Record form but
                  with the newly minted draft_id attached. BUt this TODO is in the
                  record/form.tsx*/}
                        <Route
                          path={
                            ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE +
                            ':project_id' +
                            ROUTES.RECORD_EXISTING +
                            ':record_id' +
                            ROUTES.REVISION +
                            ':revision_id'
                          }
                          element={
                            <TolerantPrivateRoute>
                              <Record />
                            </TolerantPrivateRoute>
                          }
                        />
                        <Route
                          path={
                            ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE +
                            ':project_id' +
                            ROUTES.RECORD_EXISTING +
                            ':record_id' +
                            ROUTES.REVISION +
                            ':revision_id' +
                            ROUTES.RECORD_DRAFT +
                            ':draft_id'
                          }
                          element={
                            <TolerantPrivateRoute>
                              <Record />
                            </TolerantPrivateRoute>
                          }
                        />
                        <Route
                          path={ROUTES.ABOUT_BUILD}
                          Component={AboutBuild}
                        />
                        {OFFLINE_MAPS && (
                          <Route
                            path={ROUTES.OFFLINE_MAPS}
                            Component={MapDownloadComponent}
                          />
                        )}
                        <Route path={'*'} Component={NotFound404} />
                      </Routes>
                    </MainLayout>
                  </Router>
                </ThemeProvider>
              </StyledEngineProvider>
            </QueryClientProvider>
          </ProjectsProvider>
        </NotificationProvider>
      </InitialiseGate>
    </StateProvider>
  );
}
