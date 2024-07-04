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

import React from 'react';
import {BrowserRouter as Router, Route, Routes} from 'react-router-dom';
import './App.css';
import * as ROUTES from './constants/routes';
import {PrivateRoute} from './constants/privateRouter';
import Index from './gui/pages';
import {SignIn} from './gui/pages/signin';
import {SignInReturnLoader} from './gui/pages/signin-return';
import AboutBuild from './gui/pages/about-build';
import Workspace from './gui/pages/workspace';
import NoteBookList from './gui/pages/notebook_list';
import Notebook from './gui/pages/notebook';
import Record from './gui/pages/record';
import RecordCreate from './gui/pages/record-create';
import NotFound404 from './gui/pages/404';
import {StateProvider} from './context/store';
import MainLayout from './gui/layout';
import {ThemeProvider, StyledEngineProvider} from '@mui/material/styles';

// import {unstable_createMuiStrictModeTheme as createMuiTheme} from '@mui/material';
// https://stackoverflow.com/a/64135466/3562777 temporary solution to remove findDOMNode is depreciated in StrictMode warning
// will be resolved in material-ui v5

import {createdProjects} from './sync/state';
import {ProjectsList} from 'faims3-datamodel';
import theme from './gui/theme';
import {getTokenContentsForRouting} from './users';

import {useEffect, useState} from 'react';

import {TokenContents} from 'faims3-datamodel';

// type AppProps = {};

// type AppState = {
//   projects: ProjectsList;
//   global_error: null | {};
//   token: boolean;
// };

export default function App() {
  const projects: ProjectsList = {};

  for (const active_id in createdProjects) {
    projects[active_id] = createdProjects[active_id].project;
  }

  const [token, setToken] = useState(null as null | undefined | TokenContents);

  // TODO: Rather than returning the contents of a token, we should work out
  // what details are actually needed.
  useEffect(() => {
    const getToken = async () => {
      setToken(await getTokenContentsForRouting());
    };
    getToken();
  }, []);

  return token === null ? (
    <></>
  ) : (
    <StateProvider>
      <StyledEngineProvider injectFirst>
        <ThemeProvider theme={theme}>
          <Router>
            <MainLayout token={token}>
              <Routes>
                <Route
                  path={ROUTES.SIGN_IN}
                  element={
                    <PrivateRoute allowed>
                      <SignIn setToken={setToken} />
                    </PrivateRoute>
                  }
                />
                <Route
                  path={ROUTES.SIGN_IN_RETURN}
                  Component={SignInReturnLoader}
                />
                <Route
                  path={ROUTES.WORKSPACE}
                  element={
                    <PrivateRoute allowed={Boolean(token)}>
                      <Workspace />
                    </PrivateRoute>
                  }
                />
                <Route
                  path={ROUTES.NOTEBOOK_LIST}
                  element={
                    <PrivateRoute allowed={Boolean(token)}>
                      <NoteBookList />
                    </PrivateRoute>
                  }
                />
                <Route
                  path={ROUTES.NOTEBOOK + ':project_id'}
                  element={
                    <PrivateRoute allowed={Boolean(token)}>
                      <Notebook />
                    </PrivateRoute>
                  }
                />
                {/* Draft creation happens by redirecting to a fresh minted UUID
                  This is to keep it stable until the user navigates away. So the
                  draft_id is optional, and when RecordCreate is instantiated
                  without one, it immediately mints a UUID and redirects to it */}
                <Route
                  path={
                    ROUTES.NOTEBOOK +
                    ':project_id' +
                    ROUTES.RECORD_CREATE +
                    ':type_name' +
                    ROUTES.RECORD_DRAFT +
                    ':draft_id' + //added for keep the record id same for draft
                    ROUTES.RECORD_RECORD +
                    ':record_id'
                  }
                  element={
                    <PrivateRoute allowed={Boolean(token)}>
                      <RecordCreate />
                    </PrivateRoute>
                  }
                />
                <Route
                  path={
                    ROUTES.NOTEBOOK +
                    ':project_id' +
                    ROUTES.RECORD_CREATE +
                    ':type_name'
                  }
                  element={
                    <PrivateRoute allowed={Boolean(token)}>
                      <RecordCreate />
                    </PrivateRoute>
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
                    ROUTES.NOTEBOOK +
                    ':project_id' +
                    ROUTES.RECORD_EXISTING +
                    ':record_id' +
                    ROUTES.REVISION +
                    ':revision_id'
                  }
                  element={
                    <PrivateRoute allowed={Boolean(token)}>
                      <Record />
                    </PrivateRoute>
                  }
                />
                <Route
                  path={
                    ROUTES.NOTEBOOK +
                    ':project_id' +
                    ROUTES.RECORD_EXISTING +
                    ':record_id' +
                    ROUTES.REVISION +
                    ':revision_id' +
                    ROUTES.RECORD_DRAFT +
                    ':draft_id'
                  }
                  element={
                    <PrivateRoute allowed={Boolean(token)}>
                      <Record />
                    </PrivateRoute>
                  }
                />
                <Route
                  path={'/'}
                  element={
                    <PrivateRoute allowed>
                      <Index token={token} />
                    </PrivateRoute>
                  }
                />

                <Route path={ROUTES.ABOUT_BUILD} Component={AboutBuild} />
                <Route Component={NotFound404} />
              </Routes>
            </MainLayout>
          </Router>
        </ThemeProvider>
      </StyledEngineProvider>
    </StateProvider>
  );
}
