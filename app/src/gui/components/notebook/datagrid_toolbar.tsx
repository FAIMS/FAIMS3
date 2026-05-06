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
import TuneIcon from '@mui/icons-material/Tune';
import {
  Box,
  Grid,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  useMediaQuery,
} from '@mui/material';
import {GridToolbarContainer, GridToolbarFilterButton} from '@mui/x-data-grid';
import React, {ReactNode, useEffect} from 'react';
import {usePrevious} from '../../../utils/customHooks';
import {theme} from '../../themes';

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
      placeholder="Search record data (case sensitive)"
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
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <IconButton
              onClick={handleSubmit}
              size="medium"
              data-testid="searchButton"
              sx={{
                color: theme => theme.palette.primary.main,
                transition: 'all 0.3s ease-in-out',
                '&:hover': {
                  backgroundColor: 'rgba(25, 118, 210, 0.08)',
                  transform: 'scale(1.05)',
                },
              }}
            >
              <SearchIcon
                style={{
                  color: theme.palette.primary.main,
                  fontSize: '1.75rem',
                  fontWeight: 'bold',
                }}
              />
            </IconButton>
          </InputAdornment>
        ),
        endAdornment: value && (
          <InputAdornment position="end">
            <IconButton
              onClick={handleClear}
              size="medium"
              sx={{
                color: theme.palette.secondary.main,
                transition: 'all 0.3s',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  color: '#424242',
                },
              }}
            >
              <ClearIcon
                style={{
                  color: theme.palette.secondary.main,
                  fontWeight: 'bold',
                  fontSize: '1.60rem',
                }}
              />
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
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <GridToolbarContainer
      sx={{
        padding: '8px 16px',
        borderBottom: '1px solid #e0e0e0',
        backgroundColor: '#fafafa',
        width: '100%',
      }}
    >
      <Box width="100%">
        <Stack
          // Conditional layout here
          spacing={isMobile ? 1.5 : 1}
          direction={isMobile ? 'column' : 'row'}
          alignItems={isMobile ? 'stretch' : 'center'}
        >
          {/* Search input - takes remaining space */}
          <GridToolbarSearchRecordDataButton
            handleQueryFunction={handleQueryFunction}
          />

          {/* Additional controls (e.g., sort dropdown) */}
          {additionalControls && additionalControls}

          {/* Filter button */}
          {enableFilters && (
            <Grid item sx={{flexShrink: 0}}>
              <GridToolbarFilterButton
                componentsProps={{
                  button: {
                    startIcon: (
                      <TuneIcon
                        style={{
                          color: theme.palette.primary.main,
                          fontSize: '1.85rem',
                          fontWeight: 'bold',
                          marginRight: theme.spacing(1),
                        }}
                      />
                    ),
                  },
                }}
                sx={{
                  borderRadius: '8px',
                  padding: '8px',
                  minWidth: 'auto',
                  backgroundColor: theme.palette.background.default,
                  border: '2px solid #e0e0e0',
                  transition: 'all 0.2s ease-in-out',
                  textTransform: 'none',
                  boxShadow: 'none',
                  '&:hover': {
                    backgroundColor: 'rgba(25, 118, 210, 0.08)',
                    borderColor: theme => theme.palette.primary.main,
                  },
                  '& .MuiButton-startIcon': {
                    margin: 0,
                  },
                  '& .MuiButton-endIcon': {
                    display: 'none',
                  },
                }}
              />
            </Grid>
          )}
        </Stack>
      </Box>
    </GridToolbarContainer>
  );
}
