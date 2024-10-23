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
 * Filename: table.tsx
 * Description:
 *   Components for displaying record metadata in a table.
 */

import React, {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';

import {DataGrid, GridCellParams, GridEventListener} from '@mui/x-data-grid';
import {Box, Paper, Link} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ArticleIcon from '@mui/icons-material/Article';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import * as ROUTES from '../../../constants/routes';
import {
  ProjectID,
  ProjectUIViewsets,
  RecordMetadata,
  getMetadataForAllRecords,
  getRecordsWithRegex,
} from '@faims3/data-model';
import {DEBUG_APP} from '../../../buildconfig';
import {NotebookDataGridToolbar} from './datagrid_toolbar';
import RecordDelete from './delete';
import {logError} from '../../../logging';
import {getTotalRecordCount} from './record_count_summary';
import {getCurrentUserId} from '../../../users';

type RecordsTableProps = {
  project_id: ProjectID;
  maxRows: number | null;
  rows: RecordMetadata[];
  loading: boolean;
  viewsets?: ProjectUIViewsets | null;
  handleQueryFunction: Function;
  handleRefresh: () => Promise<any>;
  onRecordsCountChange?: (counts: {total: number; myRecords: number}) => void;
};

type RecordsBrowseTableProps = {
  project_id: ProjectID;
  maxRows: number | null;
  viewsets?: ProjectUIViewsets | null;
  filter_deleted: boolean;
  handleRefresh: () => Promise<any>;
  onRecordsCountChange?: (counts: {total: number; myRecords: number}) => void;
};

function RecordsTable(props: RecordsTableProps) {
  const {project_id, maxRows, rows, loading, onRecordsCountChange} = props;
  const [currentUser, setCurrentUser] = useState<string>(''); // State to store the current user

  // default for mobileView is on (collapsed table)
  const [mobileViewSwitchValue] = React.useState(true);

  const theme = useTheme();
  const history = useNavigate();
  const not_xs = useMediaQuery(theme.breakpoints.up('sm'));

  // if screensize is > mobile, always set to false i.e., no mobile view. If mobile, allow control via the switch
  const mobileView: boolean = not_xs ? false : mobileViewSwitchValue;

  const defaultMaxRowsMobile = 10;

  // The entire row is clickable to the record
  const handleRowClick: GridEventListener<'rowClick'> = params => {
    history(
      ROUTES.getRecordRoute(
        project_id || 'dummy',
        (params.row.record_id || '').toString(),
        (params.row.revision_id || '').toString()
      )
    );
  };

  function getRowType(params: GridCellParams) {
    // The type (or Kind) is prettified and should be filterable as such.
    return props.viewsets !== null &&
      props.viewsets !== undefined &&
      params.row.type !== null &&
      params.row.type !== undefined &&
      props.viewsets[params.row.type.toString()] !== undefined
      ? (props.viewsets[params.row.type.toString()].label ?? params.row.type)
      : params.row.type;
  }

  // Filter the rows for mobile view to only include 'Site'
  const filteredRows = mobileView
    ? rows.filter(row => {
        const mockParams = {row} as GridCellParams; // Create a minimal mock GridCellParams object
        return getRowType(mockParams) === 'Site';
      })
    : rows;

  const columns = !mobileView
    ? [
        // Desktop View Columns
        {
          field: 'article_icon',
          headerName: '',
          type: 'string',
          width: 40,
          renderCell: () => <ArticleIcon sx={{my: 2}} />,
          hide: false,
          sortable: false,
          filterable: false,
          disableColumnMenu: true,
        },
        {
          field: 'type',
          headerName: 'Kind',
          type: 'string',
          width: 200,
          valueGetter: getRowType,
        },
        {
          field: 'hrid',
          headerName: 'HRID/UUID',
          description: 'Human Readable Record ID',
          type: 'string',
          width: 200,
          minWidth: 200,
          renderCell: (params: GridCellParams) => (
            <Link underline={'none'} sx={{fontWeight: 'bold'}}>
              {params.row.hrid}
            </Link>
          ),
        },
        //  We add in a hidden column (updated_filterable) to provide 'updated' as a date-only filterable field,
        //  whilst rendering the datetime version and allowing custom sorting on that field.
        {
          field: 'updated',
          headerName: 'Last Updated',
          type: 'dateTime',
          width: 200,
          filterable: false,
        },
        {
          field: 'updated_filterable',
          headerName: 'Last Updated',
          type: 'date',
          width: 200,
          filterable: true,
          valueGetter: (params: GridCellParams) => {
            return params.row.updated;
          },
          hide: true,
        },
        {
          field: 'updated_by',
          headerName: 'Last Updated By',
          type: 'string',
          width: 200,
        },
        {
          field: 'conflicts',
          headerName: 'Conflicts',
          type: 'boolean',
          width: 120,
          renderCell: (params: GridCellParams) => (
            <div>
              {params.row.conflicts ? (
                <WarningAmberIcon color={'warning'} />
              ) : (
                ''
              )}
            </div>
          ),
        },
        {
          field: 'created',
          headerName: 'Created',
          type: 'dateTime',
          width: 200,
        },
        {
          field: 'created_by',
          headerName: 'Created By',
          type: 'string',
          width: 200,
        },
        {
          field: 'record_id',
          headerName: 'UUID',
          description: 'UUID Record ID',
          type: 'string',
          filterable: true,
          hide: true,
        },

        {
          field: 'delete',
          headerName: 'Actions',
          type: 'actions',
          renderCell: (params: GridCellParams) => {
            return (
              <RecordDelete
                project_id={project_id}
                record_id={params.row.record_id}
                revision_id={params.row.revision_id}
                draft_id={null}
                show_label={false}
                handleRefresh={props.handleRefresh}
              />
            );
          },
        },
      ]
    : [
        // Mobile View Columns

        {
          field: 'street',
          headerName: 'Street',
          type: 'string',
          minWidth: 120,
          valueGetter: (params: GridCellParams) =>
            params.row.hrid.split(', ')[0] || 'Unknown',
          headerClassName: 'custom-header',
        },

        {
          field: 'suburb',
          headerName: 'Suburb',
          type: 'string',
          minWidth: 150,
          valueGetter: (params: GridCellParams) =>
            params.row.hrid.split(', ')[1] || 'Unknown',
          headerClassName: 'custom-header',
        },
        {
          field: 'created',
          headerName: 'Created',
          type: 'dateTime',
          minWidth: 150,
          filterable: true,
          hide: true,
          headerClassName: 'custom-header',
        },
      ];

  // Fetch the current user when the component mounts
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userId = await getCurrentUserId(project_id);
        setCurrentUser(userId);
      } catch (error) {
        console.error('Error fetching user ID:', error);
      }
    };
    fetchUser();
  }, [project_id]);

  useEffect(() => {
    if (!rows || rows.length === 0 || !currentUser) {
      console.log('No records available or current user not set.');
      return;
    }

    const totalRecords = getTotalRecordCount(rows);

    const myRecords = rows.filter(
      record =>
        getRowType({row: record} as GridCellParams) === 'Site' &&
        record.created_by === currentUser
    ).length;

    // Send count to parent with callback  - onRecordsCountChangee
    if (onRecordsCountChange) {
      onRecordsCountChange({total: totalRecords, myRecords});
    }
  }, [rows, currentUser, onRecordsCountChange]);

  return (
    <React.Fragment>
      <Box
        component={Paper}
        elevation={3}
        sx={{
          borderRadius: '4px',
          boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.2)',
          padding: '4px',
        }}
      >
        {' '}
        <DataGrid
          rows={filteredRows}
          loading={loading}
          getRowId={r => r.record_id}
          columns={columns}
          autoHeight
          sx={{
            cursor: 'pointer',
            '& .MuiDataGrid-columnHeaderTitle': {
              fontWeight: 'bold',
              fontSize: '1.1rem',
            },
            '& .MuiDataGrid-row': {
              height: 80,
              '&:hover': {
                backgroundColor: '#f0f0f0',
                boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.1)',
                transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
              },
            },
            '& .MuiDataGrid-cell': {
              padding: '0 10px',
              borderBottom: '1px solid #424242',
              fontSize: '1rem',
              fontWeight: 400,
            },
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: '#f9f9f9',
              borderBottom: '1px solid #424242',
              '& .MuiDataGrid-columnHeader': {
                '& .MuiDataGrid-sortIcon': {
                  opacity: 1,
                  visibility: 'visible',
                },
              },
            },
            '& .MuiDataGrid-footerContainer': {
              borderTop: '1px solid #424242',
            },
            '& .MuiDataGrid-root': {
              border: 'none',
            },
          }}
          getRowHeight={() => 'auto'}
          pageSizeOptions={[10, 25, 50, 100]}
          density={'standard'}
          disableRowSelectionOnClick
          onRowClick={handleRowClick}
          getRowClassName={params => {
            return `${params.row.conflicts ? 'bg-warning' : ''}`;
          }}
          slots={{
            toolbar: NotebookDataGridToolbar,
          }}
          slotProps={{
            filterPanel: {sx: {maxWidth: '96vw'}},
            toolbar: {
              handleQueryFunction: props.handleQueryFunction,
            },
          }}
          initialState={{
            sorting: {
              sortModel: [{field: 'created', sort: 'desc'}],
            },
            pagination: {
              paginationModel: {
                pageSize:
                  maxRows !== null
                    ? not_xs
                      ? maxRows
                      : defaultMaxRowsMobile
                    : not_xs
                      ? 25
                      : defaultMaxRowsMobile,
              },
            },
          }}
        />
      </Box>
      {/* TODO remove later RG - toggle mobile view not needed */}
      {/* {not_xs ? (
        ''
      ) : (
        <FormGroup>
          <FormControlLabel
            control={
              <Switch checked={mobileView} onChange={handleToggleMobileView} />
            }
            label={'Toggle Mobile View'}
          />
        </FormGroup>
      )} */}
    </React.Fragment>
  );
}

export function RecordsBrowseTable(props: RecordsBrowseTableProps) {
  const [query, setQuery] = React.useState('');
  const [pouchData, setPouchData] = React.useState(
    undefined as RecordMetadata[] | undefined
  );

  useEffect(() => {
    const getData = async () => {
      if (DEBUG_APP) {
        console.log('RecordsTable updating', props.project_id, query);
      }
      try {
        if (query.length === 0) {
          const ma = await getMetadataForAllRecords(
            props.project_id,
            props.filter_deleted
          );
          setPouchData(ma);
        } else {
          const ra = await getRecordsWithRegex(
            props.project_id,
            query,
            props.filter_deleted
          );
          setPouchData(ra);
        }
      } catch (err) {
        logError(err); // unable to load records
        setPouchData(undefined);
      }
    };
    getData();
  }, [props.project_id, query]);

  const rows = pouchData ?? [];
  const loading = pouchData === undefined;

  return (
    <RecordsTable
      project_id={props.project_id}
      maxRows={props.maxRows}
      rows={rows}
      loading={loading}
      viewsets={props.viewsets}
      handleQueryFunction={setQuery}
      handleRefresh={props.handleRefresh}
      onRecordsCountChange={props.onRecordsCountChange}
    />
  );
}
RecordsBrowseTable.defaultProps = {
  maxRows: null,
};
