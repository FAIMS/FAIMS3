import React from 'react';
import {
  Box,
  CircularProgress,
  Typography,
  Grid,
  Container,
} from '@material-ui/core';
import SystemAlert from './alert';

export default function LoadingApp() {
  return (
    <Container maxWidth={false}>
      <Grid
        container
        spacing={0}
        direction="column"
        alignItems="center"
        justify="center"
        style={{minHeight: '100vh'}}
      >
        <Grid item xs={3} sm={2} md={1}>
          <img src="/static/logo/Faims-medium.jpg" style={{maxWidth: '100%'}} />
        </Grid>
        <Grid item xs={3}>
          <Box mb={1} mt={2}>
            <Typography variant="subtitle2" align={'center'}>
              <b>Loading data </b>
              <CircularProgress
                color={'primary'}
                size={'0.75rem'}
                thickness={5}
              />
            </Typography>
          </Box>
          <Box mb={2}>
            <Typography variant={'body2'} align={'center'}>
              This may take some time on first load depending on your connection
              speed.
            </Typography>
          </Box>
        </Grid>
      </Grid>
      <SystemAlert />
    </Container>
  );
}
