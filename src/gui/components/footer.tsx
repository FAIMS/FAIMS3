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
 * Filename: footer.tsx
 * Description:
 *   Creates the footer with version number and debug data on all pages.
 */

import React, {useContext} from 'react';
import {useLocation} from 'react-router-dom';
import {Box, Grid, Typography} from '@material-ui/core';
import grey from '@material-ui/core/colors/grey';

import packageJson from '../../../package.json';
import {COMMIT_VERSION} from '../../buildconfig';
import {store} from '../../store';
import InProgress from './ui/inProgress';
import BoxTab from './ui/boxTab';

export default function Footer() {
  const globalState = useContext(store);
  // This is a MASSIVE hack because react-router is dumb and can't seem to work
  // out that shadowing a web API and doing it wrong is a bad idea...
  // What this does is cause the component to rerender when the location
  // changes, which means when we lookup window.location we get the latest
  // version and can do things with it
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  const location = useLocation();

  return (
    <Box bgcolor={grey[200]} mt={4} p={4}>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <code>
            Alpha: {packageJson.name} v{packageJson.version} ({COMMIT_VERSION})
          </code>
          <Box mt={2}>
            <Typography variant={'h6'}>Key</Typography>
            <InProgress />
          </Box>
        </Grid>
        <Grid item xs={12} sm={6}>
          <BoxTab
            title={'Developer tool: react GlobalState'}
            bgcolor={grey[100]}
          />
          <Box bgcolor={grey[100]} p={2} style={{overflowX: 'scroll'}}>
            <pre>
              {JSON.stringify(
                {
                  ...globalState.state,
                  alerts: globalState.state.alerts.map(alert => {
                    if ('element' in alert) {
                      // Alerts made with custom elements aren't JSON-stringifiable
                      return alert.toString();
                    } else {
                      return alert; //Regular alert
                    }
                  }),
                },
                null,
                2
              )}
            </pre>
            Current URL: <pre>{window.location.href}</pre>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
