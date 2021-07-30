/*
 * Copyright 2021 Macquarie University
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

import React, {useState} from 'react';
import {BrowserRouter as Router, Route, Switch} from 'react-router-dom';
import './App.css';
import {Index} from './gui/index';
import {MuiThemeProvider} from '@material-ui/core/styles';
import {StateProvider} from './store';

import theme from '../gui/theme';

type AppProps = {};

type AppState = {};

export default function App(props: AppProps) {
  const [state, setState] = useState({} as AppState);

  return (
    <StateProvider>
      <MuiThemeProvider theme={theme}>
        <Router>
          <Switch>
            <Route exact path="/" component={Index} />
          </Switch>
        </Router>
      </MuiThemeProvider>
    </StateProvider>
  );
}
