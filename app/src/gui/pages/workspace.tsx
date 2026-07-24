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

import {Grid, Typography} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import React from 'react';
import {config} from '../../buildconfig';
import {selectActiveUser} from '../../context/slices/authSlice';
import {useAppSelector} from '../../context/store';
import Notebooks from '../components/workspace/notebooks';

export default function Workspace() {
  const theme = useTheme();
  const activeUser = useAppSelector(selectActiveUser);
  const listing = useAppSelector(state =>
    activeUser ? state.projects.servers[activeUser.serverId] : undefined
  );
  const serverName = listing?.serverTitle;

  return (
    <React.Fragment>
      <Grid container>
        <Grid size={{xs: 12, md: 12, lg: 8}} sx={{width: '100%', minWidth: 0}}>
          <Typography
            variant="h2"
            color="text.secondary"
            sx={{mb: theme.spacing(2)}}
            data-testid="app-notebooks-heading"
          >
            My {config.notebookNamePluralCapitalized}
          </Typography>
          <Typography
            variant="h4"
            color="text.secondary"
            sx={{mb: theme.spacing(2)}}
          >
            {serverName}
          </Typography>
          <Notebooks />
        </Grid>
      </Grid>
    </React.Fragment>
  );
}
