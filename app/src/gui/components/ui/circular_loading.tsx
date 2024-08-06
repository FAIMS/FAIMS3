import {CircularProgress, Grid, Typography} from '@mui/material';
import React from 'react';

export default function CircularLoading(props: { label: string }) {
  return (
    <Grid
      container
      direction="row"
      alignItems="center"
      spacing={1}
      sx={{
        padding: 2,
        maxWidth: '100%',
        width: 'auto',
        justifyContent: { xs: 'center', sm: 'flex-start' },
      }}
    >
      <Grid item>
        <CircularProgress size={24} thickness={5} sx={{ color: 'primary.main' }} />
      </Grid>
      <Grid item>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            fontWeight: 500,
            display: { xs: 'block', sm: 'inline' }, // Stack label below spinner on small screens, inline on larger screens
            textAlign: { xs: 'center', sm: 'left' },
          }}
        >
          {props.label}
        </Typography>
      </Grid>
    </Grid>
  );
}
