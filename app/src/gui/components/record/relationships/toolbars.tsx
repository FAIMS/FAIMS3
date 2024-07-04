import {
  GridPagination,
  GridToolbarContainer,
  GridToolbarFilterButton,
} from '@mui/x-data-grid';
import {Grid} from '@mui/material';
import React from 'react';

export function RecordLinksToolbar() {
  return (
    <GridToolbarContainer>
      <Grid
        container
        spacing={2}
        direction="row"
        justifyContent="space-between"
        alignItems="center"
      >
        <Grid item>
          <GridToolbarFilterButton />
        </Grid>
        <Grid item>
          <GridPagination />
        </Grid>
      </Grid>
    </GridToolbarContainer>
  );
}
