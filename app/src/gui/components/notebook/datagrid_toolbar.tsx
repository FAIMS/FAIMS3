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

import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
import {Box, Grid, IconButton, InputAdornment, TextField} from '@mui/material';
import {GridToolbarContainer, GridToolbarFilterButton} from '@mui/x-data-grid';
import React, {ReactNode, useEffect} from 'react';
import {usePrevious} from '../../../utils/customHooks';

interface ToolbarProps {
  /** Function to handle search query changes */
  handleQueryFunction: (query: string) => void;
  /** Optional additional controls to render (e.g., sort dropdown) */
  additionalControls?: ReactNode;
}

const enableFilters = import.meta.env.VITE_ENABLE_RECORD_FILTERS !== 'false';

/**
 * Custom search button with improved layout handling.
 * Provides a text input for searching record data with submit and clear actions.
 */
export function GridToolbarSearchRecordDataButton({
  handleQueryFunction,
}: {
  handleQueryFunction: (query: string) => void;
}) {
  const [value, setValue] = React.useState('');
  const prevValue = usePrevious(value);

  /**
   * Handles the input change event in the search field.
   *
   * @param event - The event for the search input field.
   */
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value);
  };

  /**
   * Handles search submission by invoking the query function with the current value.
   */
  const handleSubmit = () => {
    handleQueryFunction(value);
  };

  /**
   * Clears the current search value and resets the search.
   */
  const handleClear = () => {
    setValue('');
  };

  /**
   * Detects changes to the search input value and triggers the query if the
   * input is cleared.
   */
  useEffect(() => {
    if (prevValue !== value && value === '') {
      handleSubmit();
    }
  }, [value]);

  /**
   * Handles Enter key press to submit search.
   */
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <TextField
      className={
        value === ''
          ? 'record-grid-searchField'
          : 'record-grid-searchField record-grid-searchField--active'
      }
      placeholder="Search record data (case sensitive)"
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyPress}
      data-testid="record-search-input"
      variant="outlined"
      size="small"
      fullWidth
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <IconButton
              className="record-grid-searchButton"
              onClick={handleSubmit}
              size="medium"
              data-testid="searchButton"
            >
              <SearchIcon className="record-grid-searchButtonIcon" />
            </IconButton>
          </InputAdornment>
        ),
        endAdornment: value && (
          <InputAdornment position="end">
            <IconButton
              className="record-grid-clearButton"
              onClick={handleClear}
              size="medium"
            >
              <ClearIcon className="record-grid-clearButtonIcon" />
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  );
}

/**
 * Main toolbar component for the DataGrid.
 * Replaces the default toolbar to include custom search, filter, and sort
 * functionalities.
 *
 * @param props - Properties including search handler and optional additional controls
 * @returns Custom toolbar for the DataGrid
 */
export function NotebookDataGridToolbar(props: ToolbarProps) {
  const {handleQueryFunction, additionalControls} = props;

  return (
    <GridToolbarContainer>
      <Box className="record-grid-toolbarContent">
        <Box className="record-grid-toolbarLayout">
          {/* Search input - takes remaining space */}
          <GridToolbarSearchRecordDataButton
            handleQueryFunction={handleQueryFunction}
          />

          {/* Additional controls (e.g., sort dropdown) */}
          {additionalControls && additionalControls}

          {/* Filter button */}
          {enableFilters && (
            <Grid item className="record-grid-filterItem">
              <GridToolbarFilterButton className="record-grid-filterButton" />
            </Grid>
          )}
        </Box>
      </Box>
    </GridToolbarContainer>
  );
}
