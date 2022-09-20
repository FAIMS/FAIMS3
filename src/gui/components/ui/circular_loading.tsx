import {CircularProgress, Grid, Typography} from '@mui/material';
import React from 'react';

export default function CircularLoading(props: {label: string}) {
  return (
    <Grid
      container
      direction="row"
      justifyContent="flex-start"
      alignItems="center"
      spacing={1}
    >
      <Grid item>
        <CircularProgress size={14} thickness={5} />
      </Grid>
      <Grid item>
        <Typography variant="body2" color="text.secondary">
          {props.label}
        </Typography>
      </Grid>
    </Grid>
  );
}
