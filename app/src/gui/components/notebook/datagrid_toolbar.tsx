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
  Divider,
  Box,
  Grid,
  TextField,
  IconButton,
  InputAdornment,
} from '@mui/material';
import {GridToolbarContainer, GridToolbarFilterButton} from '@mui/x-data-grid';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import TuneIcon from '@mui/icons-material/Tune';
import {usePrevious} from '../../../utils/custom_hooks';

interface ToolbarProps {
  handleQueryFunction: any;
}

export function GridToolbarSearchRecordDataButton(props: ToolbarProps) {
  /**
   * Only hoist query value when user presses submit or clear
   */
  const [value, setValue] = React.useState('');
  const prevValue = usePrevious(value);
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Controlled state: user has keyed in a value
    setValue(event.target.value);
  };
  const handleSubmit = () => {
    // Send value up to query function
    props.handleQueryFunction(value);
  };
  const handleClear = () => {
    //  Clear the local query string
    setValue('');
  };
  useEffect(() => {
    // if the value has changed AND it now is an empty string - submit with empty query (i.e., reset)
    if (prevValue !== value && value === '') {
      handleSubmit();
    }
  }, [value]);

  return (
    <Box style={{marginTop: '4px'}} mr={1}>
      <Grid container spacing={1} alignItems="center">
        {/* Search Bar */}
        <Grid item xs={9} sm={10} md={11}>
          <TextField
            placeholder="Search for records address"
            value={value}
            onChange={handleChange}
            variant="outlined"
            size="small"
            fullWidth
            sx={{
              p: 0,
              backgroundColor: '#f0f0f0',
              borderRadius: '5px',
              boxShadow: value ? '0 0 12px rgba(0, 0, 0, 0.3)' : 'none',
              '& .MuiOutlinedInput-root': {
                '&.Mui-focused': {
                  boxShadow: '0 0 15px rgba(0, 0, 0, 0.4)',
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
                      '&:hover': {
                        boxShadow: '0 0 8px rgba(0, 0, 0, 0.3)',
                      },
                      '&:active': {
                        boxShadow: '0 0 12px rgba(0, 0, 0, 0.4)',
                      },
                    }}
                  >
                    <SearchIcon
                      style={{
                        color: 'black',
                        fontWeight: 'bold',
                        fontSize: '1.65rem',
                      }}
                    />
                  </IconButton>
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={handleClear}
                    size="medium"
                    sx={{
                      '&:hover': {
                        boxShadow: '0 0 8px rgba(0, 0, 0, 0.3)',
                      },
                      '&:active': {
                        boxShadow: '0 0 12px rgba(0, 0, 0, 0.4)',
                      },
                    }}
                  >
                    <ClearIcon
                      style={{
                        color: 'black',
                        fontWeight: 'bold',
                        fontSize: '1.60rem',
                      }}
                    />
                  </IconButton>
                </InputAdornment>
              ),
              sx: {
                '& .MuiInputBase-input::placeholder': {
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                },
              },
            }}
          />
        </Grid>

        {/* Filter Button */}
        <Grid item xs={3} sm={2} md={1}>
          <GridToolbarFilterButton
            componentsProps={{
              button: {
                startIcon: (
                  <TuneIcon
                    style={{
                      color: 'black',
                      fontSize: '1.85rem',
                      fontWeight: 'bold',
                    }}
                  />
                ),
              },
            }}
            sx={{
              fontSize: {xs: '0.8rem', sm: '1rem'},
              fontWeight: 'bold',
              color: 'black',
              minWidth: 'fit-content',
              '&:hover': {
                boxShadow: '0 0 8px rgba(0, 0, 0, 0.3)',
              },
              '&:active': {
                boxShadow: '0 0 12px rgba(0, 0, 0, 0.4)',
              },
            }}
          />
        </Grid>
      </Grid>
    </Box>
  );
}

export function NotebookDataGridToolbar(props: ToolbarProps) {
  return (
    <GridToolbarContainer>
      <Grid
        container
        spacing={1}
        justifyContent="space-between"
        alignItems="center"
      >
        {/* <Grid item alignItems={'stretch'}> */}
        {/*<GridToolbarColumnsButton />*/}
        {/* <GridToolbarFilterButton sx={{ml: 1}} /> */}
        {/*<GridToolbarDensitySelector />*/}
        {/* </Grid> */}
        <Grid item>
          <GridToolbarSearchRecordDataButton
            handleQueryFunction={props.handleQueryFunction}
          />
        </Grid>
        <Grid item xs={12}>
          <Divider />
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
          {/*<GridToolbarColumnsButton />*/}
          <GridToolbarFilterButton />
          {/*<GridToolbarDensitySelector />*/}
        </Grid>
      </Grid>
    </GridToolbarContainer>
  );
}
