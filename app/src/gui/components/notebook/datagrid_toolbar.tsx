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

import React, {useEffect} from 'react';
import {
  Box,
  Grid,
  TextField,
  InputAdornment,
  IconButton,
  Paper,
} from '@mui/material';
import {GridToolbarContainer, GridToolbarFilterButton} from '@mui/x-data-grid';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import TuneIcon from '@mui/icons-material/Tune';
import {usePrevious} from '../../../utils/customHooks';
import {theme} from '../../themes';

interface ToolbarProps {
  handleQueryFunction: any;
}

const enableFilters = import.meta.env.VITE_ENABLE_RECORD_FILTERS !== 'false';

/**
 * Custom search button with improved layout handling
 */
export function GridToolbarSearchRecordDataButton(props: ToolbarProps) {
  const [value, setValue] = React.useState('');
  const prevValue = usePrevious(value);

  /**
   * Handles the input change event in the search field.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event - The event for the search input field.
   */
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('handleChange', event.target.value);
    setValue(event.target.value);
  };

  /**
   * Handles search submission by invoking the query function with the current value.
   */
  const handleSubmit = () => {
    console.log('handleSubmit', value);
    props.handleQueryFunction(value);
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

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <Box
      component={Paper}
      elevation={0}
      sx={{
        backgroundColor: 'transparent',
      }}
    >
      <Grid container spacing={1} alignItems="center" wrap="nowrap">
        <Grid item xs>
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
        </Grid>

        {enableFilters && (
          <Grid item sx={{flexShrink: 0, ml: 1}}>
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
                boxShadow: value ? '0 2px 4px rgba(0, 0, 0, 0.15)' : 'none',
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
      </Grid>
    </Box>
  );
}

/**
 * Main toolbar component for the DataGrid.
 * This replaces the default toolbar to include custom search and filter functionalities.
 *
 * @param props - Properties to handle search functionality.
 * @returns Custom toolbar for the DataGrid.
 */
export function NotebookDataGridToolbar(props: ToolbarProps) {
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
        <GridToolbarSearchRecordDataButton
          handleQueryFunction={props.handleQueryFunction}
        />
      </Box>
    </GridToolbarContainer>
  );
}

/**
 * Alternate toolbar for managing draft DataGrid, with basic functionality like filters.
 *
 * @returns A simple toolbar for drafts with filter options.
 */
export function NotebookDraftDataGridToolbar() {
  return (
    <GridToolbarContainer>
      <Grid
        container
        spacing={2}
        justifyContent="space-between"
        alignItems="center"
      >
        {enableFilters && (
          <Grid item>
            <GridToolbarFilterButton />
          </Grid>
        )}
      </Grid>
    </GridToolbarContainer>
  );
}
