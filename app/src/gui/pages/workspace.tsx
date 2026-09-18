// SPDX-License-Identifier: Apache-2.0

/*
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
