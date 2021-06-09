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
 * Filename: footer.tsx
 * Description:
 *   Creates the footer with version number and debug data on all pages.
 */

import React, {useContext} from 'react';
import packageJson from '../../../package.json';
import {Box, Grid, Typography} from '@material-ui/core';
import {store} from '../../store';
import grey from '@material-ui/core/colors/grey';
import InProgress from './ui/inProgress';
import BoxTab from './ui/boxTab';
import {COMMIT_VERSION} from '../../buildconfig';
export default function Footer() {
  const globalState = useContext(store);

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
            <pre>{JSON.stringify(globalState.state, null, 2)}</pre>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
