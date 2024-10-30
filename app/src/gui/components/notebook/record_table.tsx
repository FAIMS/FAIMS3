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
import {Typography, Box, Paper, Alert, Grid, Link} from '@mui/material';
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
import {NotebookDataGridToolbar} from './datagrid_toolbar';
import RecordDelete from './delete';
import getLocalDate from '../../fields/LocalDate';
import {logError} from '../../../logging';
import {getCurrentUserId} from '../../../users';
import {getTotalRecordCount} from '../../../utils/record_summary';

type RecordsTableProps = {
  project_id: ProjectID;
  maxRows: number | null;
  rows: RecordMetadata[];
  loading: boolean;
  viewsets?: ProjectUIViewsets | null;
  handleQueryFunction: Function;
  handleRefresh: () => void;
  onRecordsCountChange?: (counts: {total: number; myRecords: number}) => void;
  recordLabel: string; // Add recordLabel prop
};

type RecordsBrowseTableProps = {
  project_id: ProjectID;
  maxRows: number | null;
  viewsets?: ProjectUIViewsets | null;
  filter_deleted: boolean;
  handleRefresh: () => void;
  onRecordsCountChange?: (counts: {total: number; myRecords: number}) => void;
  recordLabel: string; // Add recordLabel prop
};

function RecordsTable(props: RecordsTableProps) {
  const {
    project_id,
    maxRows,
    rows,
    loading,
    onRecordsCountChange,
    recordLabel,
  } = props;
  const [currentUser, setCurrentUser] = useState<string>('');

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

  // Updated helper function using dynamic recordLabel
  const getUserRecordCount = (records: RecordMetadata[]) => {
    return records.filter(
      record =>
        getRowType({row: record} as GridCellParams) === recordLabel &&
        record.created_by === currentUser
    ).length;
  };

  const columns = !mobileView
    ? [
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
        {
          field: 'type',
          headerName: 'Kind',
          type: 'string',
          filterable: true,
          hide: true,
          minWidth: 75,
          valueGetter: getRowType,
        },
        {
          field: 'hrid',
          headerName: 'HRID/UUID',
          description: 'Human Readable Record ID',
          type: 'string',
          minWidth: 150,
          filterable: true,
          renderCell: (params: GridCellParams) => {
            return (
              <Box sx={{width: '100%', my: 1}}>
                <Grid
                  container
                  direction="row"
                  justifyContent="flex-start"
                  alignItems="center"
                  spacing={0}
                >
                  <Grid item>
                    <Typography>Kind: {getRowType(params)}</Typography>
                  </Grid>
                </Grid>

                <Typography color="textSecondary">
                  HRID/UUID: {JSON.stringify(params.value)}
                </Typography>
                {/*  If updated isn't present, then show created meta */}
                {params.row.updated === undefined ? (
                  <Typography
                    color="textSecondary"
                    variant="subtitle2"
                    gutterBottom
                    component="div"
                  >
                    Created{' '}
                    {params.row.created !== undefined &&
                      params.row.created !== '' &&
                      getLocalDate(params.row.created).replace('T', ' ')}{' '}
                    by {params.row.created_by}
                  </Typography>
                ) : (
                  <Typography
                    color="textSecondary"
                    variant="subtitle2"
                    gutterBottom
                    component="div"
                  >
                    Updated{' '}
                    {params.row.updated !== undefined &&
                      params.row.updated !== '' &&
                      getLocalDate(params.row.updated).replace('T', ' ')}{' '}
                    by {params.row.updated_by}
                  </Typography>
                )}

                {params.row.conflicts === true && (
                  <Alert severity={'warning'}>Record has conflicts</Alert>
                )}
              </Box>
            );
          },
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
        {
          field: 'updated',
          headerName: 'Last Updated',
          type: 'dateTime',
          filterable: true,
          hide: true,
        },
        {
          field: 'updated_by',
          headerName: 'Last Updated By',
          type: 'string',
          filterable: true,
          hide: true,
        },
        {
          field: 'conflicts',
          headerName: 'Conflicts',
          type: 'boolean',
          filterable: true,
          hide: true,
        },
        {
          field: 'created',
          headerName: 'Created',
          type: 'dateTime',
          filterable: true,
          hide: true,
        },
        {
          field: 'created_by',
          headerName: 'Created By',
          type: 'string',
          filterable: true,
          hide: true,
        },
        {
          field: 'record_id',
          headerName: 'UUID',
          description: 'UUID Record ID',
          type: 'string',
          filterable: true,
          hide: true,
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
    if (!rows || rows.length === 0) {
      if (onRecordsCountChange) onRecordsCountChange({total: 0, myRecords: 0});
      return;
    }

    const totalRecords = getTotalRecordCount(rows);
    const myRecords = getUserRecordCount(rows);

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
          rows={rows}
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
    </React.Fragment>
  );
}

export function RecordsBrowseTable(props: RecordsBrowseTableProps) {
  const {
    project_id,
    maxRows,
    viewsets,
    filter_deleted,
    handleRefresh,
    onRecordsCountChange,
    recordLabel,
  } = props;

  const [query, setQuery] = React.useState('');
  const [pouchData, setPouchData] = React.useState(
    undefined as RecordMetadata[] | undefined
  );

  useEffect(() => {
    const getData = async () => {
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
      recordLabel={recordLabel} // Pass recordLabel to RecordsTable
    />
  );
}
RecordsBrowseTable.defaultProps = {
  maxRows: null,
};
