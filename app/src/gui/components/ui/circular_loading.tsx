import { CircularProgress, Grid, Typography } from '@mui/material';
import React from 'react';

/**
 * CircularLoading component displays a loading spinner with a label, 
 * designed to be responsive and centered on different screen sizes.
 *
 * @param {Object} props - The component props
 * @param {string} props.label - The label text displayed next to the spinner
 * @returns {JSX.Element} The rendered CircularLoading component
 */

export default function CircularLoading(props: { label: string }) {
  return (
    <Grid
      container
      direction={{ xs: 'column', sm: 'row' }}
      alignItems="center"
      justifyContent="center" 
      spacing={2}
      sx={{
        padding: 3,
        maxWidth: '100%',
        width: '100%',
        minHeight: { xs: '60vh', sm: 'auto' },
        textAlign: 'center',
      }}
    >
      <Grid item>
        <CircularProgress
          size={36}
          thickness={5}
          sx={{
            color: 'primary.main',
          }}
        />
      </Grid>
      <Grid item>
        <Typography
          variant="h6" // Slightly larger text for better readability
          color="text.secondary"
          sx={{
            fontWeight: 600, // Bolder text for better emphasis
            display: 'block',
            mt: { xs: 2, sm: 0 }, // Add margin-top on small screens to separate from spinner
          }}
        >
          {props.label}
        </Typography>
      </Grid>
    </Grid>
  );
}
