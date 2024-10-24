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
  IconButton,
  InputAdornment,
  Paper,
} from '@mui/material';
import {GridToolbarContainer, GridToolbarFilterButton} from '@mui/x-data-grid';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import TuneIcon from '@mui/icons-material/Tune';
import {usePrevious} from '../../../utils/custom_hooks';
import {theme} from '../../themes';

interface ToolbarProps {
  handleQueryFunction: any;
}

/**
 * Custom search button to search record data with filtering capability.
 *
 * @param {ToolbarProps} props - Properties passed to handle search query functionality.
 * @returns {JSX.Element} The search input field with a clear and search button.
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
    setValue(event.target.value);
  };

  /**
   * Handles search submission by invoking the query function with the current value.
   */
  const handleSubmit = () => {
    props.handleQueryFunction(value);
  };

  /**
   * Clears the current search value and resets the search.
   */
  const handleClear = () => {
    setValue('');
  };

  /**
   * Detects changes to the search input value and triggers the query if the input is cleared.
   */
  useEffect(() => {
    if (prevValue !== value && value === '') {
      handleSubmit();
    }
  }, [value]);

  return (
    <Box
      component={Paper}
      elevation={0}
      sx={{
        mt: 1,
        mr: 1,
        borderRadius: '8px',
        backgroundColor: 'transparent',
      }}
    >
      <Grid container spacing={1} alignItems="center">
        <Grid item xs={9} sm={10} md={11}>
          <TextField
            placeholder="Search record data (case sensitive)"
            value={value}
            onChange={handleChange}
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
                '& .MuiOutlinedInput-root': {
                  '&.Mui-focused': {
                    boxShadow: '0 0 15px rgba(0, 0, 0, 0.4)',
                  },
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
                        boxShadow: '0 0 8px rgba(0, 0, 0, 0.3)',
                      },
                      '&:active': {
                        transform: 'scale(0.95)',
                        boxShadow: '0 0 12px rgba(0, 0, 0, 0.4)',
                      },
                    }}
                  >
                    <SearchIcon
                      style={{
                        color: theme.palette.primary.main,
                        fontSize: '1.75rem',
                        fontWeight: 'bold',
                      }}
                    />{' '}
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
                      '&:active': {
                        transform: 'scale(0.95)',
                      },
                    }}
                  >
                    <ClearIcon
                      style={{
                        color: theme.palette.secondary.main,
                        fontWeight: 'bold',
                        fontSize: '1.60rem',
                      }}
                    />{' '}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Grid>

        <Grid item xs={3} sm={2} md={1}>
          <GridToolbarFilterButton
            componentsProps={{
              button: {
                startIcon: (
                  <TuneIcon
                    style={{
                      color: theme.palette.primary.main,
                      fontSize: '1.85rem',
                      fontWeight: 'bold',
                    }}
                  />
                ),
              },
            }}
            sx={{
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: {xs: '0.9rem', sm: '1.2rem'},
              fontWeight: 'bold',
              color: '#424242',
              backgroundColor: '#ffffff',
              border: '1px solid #e0e0e0',
              transition: 'all 0.2s ease-in-out',
              textTransform: 'none',
              boxShadow: value ? '0 2px 4px rgba(0, 0, 0, 0.15)' : 'none',

              '&:hover': {
                backgroundColor: 'rgba(25, 118, 210, 0.08)',
                borderColor: theme => theme.palette.primary.main,
              },
              '&:active': {
                boxShadow: '0 0 12px rgba(0, 0, 0, 0.4)',
              },
              '&.MuiButton-root': {
                minWidth: 'auto',
                whiteSpace: 'nowrap',
              },
              '& .MuiButton-startIcon': {
                marginRight: '4px',
              },
            }}
          />
        </Grid>
      </Grid>
    </Box>
  );
}

/**
 * Main toolbar component for the DataGrid.
 * This replaces the default toolbar to include custom search and filter functionalities.
 *
 * @param {ToolbarProps} props - Properties to handle search functionality.
 * @returns {JSX.Element} Custom toolbar for the DataGrid.
 */
export function NotebookDataGridToolbar(props: ToolbarProps) {
  return (
    <GridToolbarContainer
      sx={{
        padding: '8px 16px',
        borderBottom: '1px solid #e0e0e0',
        backgroundColor: '#fafafa',
      }}
    >
      <Grid
        container
        spacing={1}
        justifyContent="space-between"
        alignItems="center"
      >
        <Grid item xs={12}>
          <GridToolbarSearchRecordDataButton
            handleQueryFunction={props.handleQueryFunction}
          />
        </Grid>
      </Grid>
    </GridToolbarContainer>
  );
}

/**
 * Alternate toolbar for managing draft DataGrid, with basic functionality like filters.
 *
 * @returns {JSX.Element} A simple toolbar for drafts with filter options.
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
        <Grid item>
          {/*<GridToolbarColumnsButton />*/}
          <GridToolbarFilterButton />
          {/*<GridToolbarDensitySelector />*/}
        </Grid>
      </Grid>
    </GridToolbarContainer>
  );
}
