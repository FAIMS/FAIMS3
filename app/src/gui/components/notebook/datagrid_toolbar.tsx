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
import {IconButton, InputAdornment, TextField} from '@mui/material';
import {Toolbar, ToolbarButton} from '@mui/x-data-grid';
import React, {ReactElement, useEffect} from 'react';
import {usePrevious} from '../../../utils/customHooks';

interface ToolbarProps {
  /** Function to handle search query changes */
  handleQueryFunction: (query: string) => void;
  /** additional controls to render (e.g., sort dropdown) */
  additionalControls: ReactElement;
}

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
      placeholder="Search record data"
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyPress}
      data-testid="record-search-input"
      variant="outlined"
      size="small"
      fullWidth
      sx={{
        '& .MuiOutlinedInput-root': {
          backgroundColor: '#ffffff',
          transition: 'all 0.3s ease-in-out',
          borderRadius: '8px',
          boxShadow: value ? '0 2px 4px rgba(0, 0, 0, 0.15)' : 'none',
          border: '1px solid #e0e0e0',
          '&:hover': {
            borderColor: '#bdbdbd',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
          },
          '&.Mui-focused': {
            borderColor: '#e0e0e0',
            boxShadow: 'none',
          },
        },
        '& .MuiOutlinedInput-input': {
          padding: '10px 14px',
          fontSize: '0.9rem',
          '&::placeholder': {
            color: '#757575',
            opacity: 0.8,
          },
        },
      }}
      slotProps={{
        htmlInput: {
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
          endAdornment: value ? (
            <InputAdornment position="end">
              <IconButton
                className="record-grid-clearButton"
                onClick={handleClear}
                size="medium"
              >
                <ClearIcon className="record-grid-clearButtonIcon" />
              </IconButton>
            </InputAdornment>
          ) : undefined,
        },
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
    <Toolbar>
      {/* Search input - takes remaining space */}
      <ToolbarButton
        render={() => (
          <GridToolbarSearchRecordDataButton
            handleQueryFunction={handleQueryFunction}
          />
        )}
      />

      {/* Additional controls (e.g., sort dropdown) */}
      <ToolbarButton render={() => additionalControls} />
    </Toolbar>
  );
}
