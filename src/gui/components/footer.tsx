import React, {useContext} from 'react';
import packageJson from '../../../package.json';
import {Box, Grid, Typography} from '@material-ui/core';
import {store} from '../../store';
import grey from '@material-ui/core/colors/grey';
import InProgress from './inProgress';
import BoxTab from './boxTab';

export default function Footer() {
  const globalState = useContext(store);

  return (
    <Box bgcolor={grey[200]} mt={4} p={4}>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <code>
            Alpha: {packageJson.name} v{packageJson.version}
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
