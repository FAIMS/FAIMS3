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
 * Filename: workspace.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import {Typography, Grid} from '@mui/material';
import Notebooks from '../components/workspace/notebooks';
import Breadcrumbs from '../components/ui/breadcrumbs';
import {NOTEBOOK_NAME_CAPITALIZED} from '../../buildconfig';
import {useTheme} from '@mui/material/styles';

export default function Workspace() {
  const theme = useTheme();
  return (
    <React.Fragment>
      <Breadcrumbs data={[{title: 'Workspace'}]} />
      <Grid container spacing={3}>
        <Grid item xs={12} md={12} lg={8}>
          <Typography
            variant="h1"
            color="textSecondary"
            style={{marginBottom: theme.spacing(2)}}
          >
            My {NOTEBOOK_NAME_CAPITALIZED}s
          </Typography>
          <Notebooks />
        </Grid>
      </Grid>
    </React.Fragment>
  );
}
