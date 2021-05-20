import React, {useContext} from 'react';
import {Box, Grid, Typography} from '@material-ui/core';
import {store} from '../../store';
import grey from '@material-ui/core/colors/grey';

export default function Footer() {
  const globalState = useContext(store);

  return (
    <Box bgcolor={grey[200]} mt={4} p={4}>
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Typography variant={'overline'}>GlobalState</Typography>
          <Box bgcolor={grey[100]} p={2} style={{overflowX: 'scroll'}}>
            <pre>{JSON.stringify(globalState.state, null, 2)}</pre>
          </Box>
        </Grid>
        <Grid item xs={6}>
          <Typography variant={'overline'}>pouchDB</Typography>
          <Box bgcolor={grey[100]} p={2} style={{overflowX: 'scroll'}}>
            {/*<pre>{JSON.stringify(globalState.state, null, 2)}</pre>*/}
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
