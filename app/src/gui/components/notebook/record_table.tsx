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

import React, {useEffect} from 'react';
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

/**
 * Props for the RecordsTable component
 *
 * @typedef {Object} RecordsTableProps
 * @property {ProjectID} project_id - The ID of the project.
 * @property {number|null} maxRows - Max rows to display, or null for unlimited.
 * @property {RecordMetadata[]} rows - Array of record metadata objects.
 * @property {boolean} loading - Whether the table is in a loading state.
 * @property {ProjectUIViewsets|null} [viewsets] - Optional viewsets configuration for the table.
 * @property {Function} handleQueryFunction - Function to handle query changes.
 * @property {Function} handleRefresh - Function to handle table refresh.
 */
type RecordsTableProps = {
  project_id: ProjectID;
  maxRows: number | null;
  rows: RecordMetadata[];
  loading: boolean;
  viewsets?: ProjectUIViewsets | null;
  handleQueryFunction: Function;
  handleRefresh: () => void;
};

/**
 * Props for the RecordsBrowseTable component
 *
 * @typedef {Object} RecordsBrowseTableProps
 * @property {ProjectID} project_id - The ID of the project.
 * @property {number|null} maxRows - Max rows to display, or null for unlimited.
 * @property {ProjectUIViewsets|null} [viewsets] - Optional viewsets configuration for the table.
 * @property {boolean} filter_deleted - Whether to filter deleted records.
 * @property {Function} handleRefresh - Function to handle table refresh.
 */
type RecordsBrowseTableProps = {
  project_id: ProjectID;
  maxRows: number | null;
  viewsets?: ProjectUIViewsets | null;
  filter_deleted: boolean;
  handleRefresh: () => void;
};

/**
 * Component to render the records in a DataGrid table.
 *
 * @param {RecordsTableProps} props - The properties passed to the RecordsTable.
 * @returns {JSX.Element} The rendered DataGrid with record metadata.
 */
function RecordsTable(props: RecordsTableProps) {
  const {project_id, maxRows, rows, loading} = props;
  const theme = useTheme();
  const history = useNavigate();

  // Determine whether the view is mobile or desktop based on screen size
  const not_xs = useMediaQuery(theme.breakpoints.up('sm'));
  const mobileView: boolean = !not_xs;
  const defaultMaxRowsMobile = 10;

  /**
   * Redirects to the record detail view when a row is clicked.
   *
   * @param {GridEventListener<'rowClick'>} params - The row click event params.
   */ const handleRowClick: GridEventListener<'rowClick'> = params => {
    history(
      ROUTES.getRecordRoute(
        project_id || 'dummy',
        (params.row.record_id || '').toString(),
        (params.row.revision_id || '').toString()
      )
    );
  };

  /**
   * Retrieves a prettified label for the row type based on the viewset configuration.
   *
   * @param {GridCellParams} params - Parameters from the DataGrid cell.
   * @returns {string} The prettified row type or the original type if no viewset label is found.
   */
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

  /**
   * Defines columns for the DataGrid, separate for mobile and desktop views.
   * - Desktop view has more columns and visual elements.
   * - Mobile view simplifies the table for smaller screens.
   */
  const columns = !mobileView
    ? [
        {
          field: 'article_icon',
          headerName: '',
          type: 'string',
          width: 40,
          renderCell: () => (
            <Box sx={{display: 'flex', alignItems: 'center', height: '100%'}}>
              <ArticleIcon color="primary" />
            </Box>
          ),
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
          renderCell: (params: GridCellParams) => (
            <Typography variant="body1" fontWeight="500">
              {getRowType(params)}
            </Typography>
          ),
        },
        {
          field: 'hrid',
          headerName: 'HRID/UUID',
          description: 'Human Readable Record ID',
          type: 'string',
          width: 200,
          minWidth: 200,
          renderCell: (params: GridCellParams) => (
            <Link
              underline="hover"
              sx={{
                fontWeight: 500,
                color: theme.palette.primary.main,
                '&:hover': {
                  color: theme.palette.primary.dark,
                },
              }}
            >
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
          renderCell: (params: GridCellParams) => (
            <Typography>
              {params.row.updated &&
                getLocalDate(params.row.updated).replace('T', ' ')}
            </Typography>
          ),
          width: 200,
          filterable: false,
        },
        {
          field: 'updated_filterable',
          headerName: 'Last Updated',
          type: 'date',
          width: 200,
          renderCell: (params: GridCellParams) => (
            <Typography>{params.row.updated_by}</Typography>
          ),
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
          renderCell: (params: GridCellParams) => (
            <Typography>{params.row.updated_by}</Typography>
          ),
        },
        {
          field: 'conflicts',
          headerName: 'Conflicts',
          type: 'boolean',
          width: 120,
          renderCell: (params: GridCellParams) => (
            <Box sx={{display: 'flex', alignItems: 'center'}}>
              {params.row.conflicts && (
                <WarningAmberIcon color="warning" sx={{marginRight: 1}} />
              )}
            </Box>
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
        // Simplified mobile view with fewer columns

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
          renderCell: (params: GridCellParams) => (
            <Box
              sx={{
                py: 2,
                px: 1,
                width: '100%',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                },
              }}
            >
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography
                    variant="subtitle1"
                    fontWeight="500"
                    color="primary"
                  >
                    {getRowType(params)}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    HRID/UUID: {params.row.hrid}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    {params.row.updated ? (
                      <>
                        Updated{' '}
                        {getLocalDate(params.row.updated).replace('T', ' ')}
                        <br />
                        by {params.row.updated_by}
                      </>
                    ) : (
                      <>
                        Created{' '}
                        {getLocalDate(params.row.created).replace('T', ' ')}
                        <br />
                        by {params.row.created_by}
                      </>
                    )}
                  </Typography>
                </Grid>
                {params.row.conflicts && (
                  <Grid item xs={12}>
                    <Alert
                      severity="warning"
                      icon={<WarningAmberIcon />}
                      sx={{
                        py: 0,
                        '& .MuiAlert-message': {
                          padding: '8px 0',
                        },
                      }}
                    >
                      Record has conflicts
                    </Alert>
                  </Grid>
                )}
              </Grid>
            </Box>
          ),
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

  return (
    <React.Fragment>
      <Box
        component={Paper}
        elevation={3}
        sx={{
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
          '& .MuiDataGrid-root': {
            border: 'none',
          },
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
              fontSize: '1rem',
              color: theme.palette.text.primary,
              visibility: 'visible',
            },
            '& .MuiDataGrid-main': {
              px: 2,
            },
            '& .MuiDataGrid-row': {
              height: 'auto',
              minHeight: '64px',
              '&:hover': {
                backgroundColor: '#f5f5f5',
                boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.2s ease-in-out',
              },
            },
            '&:focus': {
              outline: '2px solid #DFA75998',
              backgroundColor: '#e3f2fd',
            },
            '& .MuiDataGrid-cell': {
              padding: '14px 20px',
              borderBottom: `2px solid ${theme.palette.divider}`,
              fontSize: '0.97rem',
              whiteSpace: 'normal',
              overflow: 'visible',
              color: theme.palette.text.primary,
              '&:focus': {
                outline: 'none',
              },
            },
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: theme.palette.background.default,
              borderBottom: `2px solid ${theme.palette.divider}`,
              '& .MuiDataGrid-columnHeader': {
                padding: '12px 16px',
                '&:focus': {
                  outline: 'none',
                },
                '& .MuiDataGrid-sortIcon': {
                  opacity: 1,
                  color: theme.palette.text.secondary,
                  visibility: 'visible',
                },
              },
            },
            '& .MuiDataGrid-footerContainer': {
              borderTop: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.background.default,
              minHeight: '52px',
            },
            '& .MuiTablePagination-root': {
              color: theme.palette.text.secondary,
              '& .MuiTablePagination-select': {
                marginRight: 2,
              },
            },
            [theme.breakpoints.down('sm')]: {
              '& .MuiDataGrid-cell': {
                padding: '8px 14px',
              },
              '& .MuiDataGrid-columnHeaders': {
                '& .MuiDataGrid-columnHeader': {
                  padding: '8px 14px',
                },
              },
            },
            '& .conflict-row': {
              backgroundColor: `${theme.palette.warning.light}!important`,
              '&:hover': {
                backgroundColor: `${theme.palette.warning.light}!important`,
                opacity: 0.9,
              },
            },
          }}
          getRowHeight={() => 'auto'}
          pageSizeOptions={[10, 25, 50, 100]}
          density={not_xs ? 'standard' : 'comfortable'}
          disableRowSelectionOnClick
          onRowClick={handleRowClick}
          getRowClassName={params =>
            params.row.conflicts ? 'conflict-row' : ''
          }
          slots={{
            toolbar: NotebookDataGridToolbar,
          }}
          slotProps={{
            filterPanel: {
              sx: {maxWidth: '96vw'},
            },
            toolbar: {
              handleQueryFunction: props.handleQueryFunction,
            },
          }}
          initialState={{
            sorting: {
              sortModel: [{field: 'updated', sort: 'desc'}],
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

/**
 * Component to handle browsing records and querying with search.
 *
 * @param {RecordsBrowseTableProps} props - The properties passed to RecordsBrowseTable.
 * @returns {JSX.Element} The rendered table for browsing records.
 */
export function RecordsBrowseTable(props: RecordsBrowseTableProps) {
  const [query, setQuery] = React.useState('');
  const [pouchData, setPouchData] = React.useState(
    undefined as RecordMetadata[] | undefined
  );

  /**
   * Fetches metadata for all records or filtered records based on the query.
   */
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
    />
  );
}
RecordsBrowseTable.defaultProps = {
  maxRows: null,
};
