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
 * Filename: datagrid_toolbar.tsx
 * Description:
 *   File is creating custom tool bar instead of default GridToolbar to disable export button
 */

import React from 'react';
import {IconButton, InputBase, Paper, Box, Grid} from '@mui/material';
import {
  GridToolbarContainer,
  GridToolbarColumnsButton,
  GridToolbarFilterButton,
  GridToolbarDensitySelector,
} from '@mui/x-data-grid';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
interface ToolbarProps {
  handleQueryFunction: any;
}

export function GridToolbarSearchRecordDataButton(props: ToolbarProps) {
  /**
   * Only hoist query value when user presses submit or clear
   */
  const [value, setValue] = React.useState('');
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value);
  };
  const handleSubmit = () => {
    props.handleQueryFunction(value);
  };
  const handleClear = () => {
    setValue('');
    handleSubmit();
  };
  return (
    <Box sx={{display: 'flex', alignItems: 'flex-end'}}>
      <Paper
        component="form"
        elevation={0}
        variant={'outlined'}
        sx={{p: '2px 4px', display: 'flex', alignItems: 'center'}}
      >
        <IconButton sx={{p: '10px'}} aria-label="menu" onClick={handleClear}>
          <ClearIcon />
        </IconButton>
        <InputBase
          id="notebook-record-data-search"
          inputProps={{'aria-label': 'Search record data'}}
          size="small"
          value={value}
          onChange={handleChange}
        />
        <IconButton
          type="button"
          sx={{p: '10px'}}
          aria-label="search"
          onClick={handleSubmit}
        >
          <SearchIcon />
        </IconButton>
      </Paper>
    </Box>
  );
}

export function NotebookDataGridToolbar(props: ToolbarProps) {
  return (
    <GridToolbarContainer>
      <Grid
        container
        spacing={2}
        justifyContent="space-between"
        alignItems="center"
      >
        <Grid item>
          <GridToolbarColumnsButton />
          <GridToolbarFilterButton />
          <GridToolbarDensitySelector />
        </Grid>
        <Grid item>
          <GridToolbarSearchRecordDataButton
            handleQueryFunction={props.handleQueryFunction}
          />
        </Grid>
      </Grid>
    </GridToolbarContainer>
  );
}
export function NotebookDraftDataGridToolbar() {
  return (
    <GridToolbarContainer>
      <Grid
        container
        spacing={2}
        justifyContent="space-between"
        alignItems="center"
      >
        <Grid item>
          <GridToolbarColumnsButton />
          <GridToolbarFilterButton />
          <GridToolbarDensitySelector />
        </Grid>
      </Grid>
    </GridToolbarContainer>
  );
}
