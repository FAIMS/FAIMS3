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
import {
  Typography,
  Box,
  Paper,
  Alert,
  Grid,
  FormGroup,
  FormControlLabel,
  Switch,
  Link,
} from '@mui/material';
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
} from 'faims3-datamodel';
import {DEBUG_APP} from '../../../buildconfig';
import {NotebookDataGridToolbar} from './datagrid_toolbar';
import RecordDelete from './delete';
import getLocalDate from '../../fields/LocalDate';
import {logError} from '../../../logging';

type RecordsTableProps = {
  project_id: ProjectID;
  maxRows: number | null;
  rows: RecordMetadata[];
  loading: boolean;
  viewsets?: ProjectUIViewsets | null;
  handleQueryFunction: Function;
  handleRefresh: () => Promise<any>;
};

type RecordsBrowseTableProps = {
  project_id: ProjectID;
  maxRows: number | null;
  viewsets?: ProjectUIViewsets | null;
  filter_deleted: boolean;
  handleRefresh: () => Promise<any>;
};

function RecordsTable(props: RecordsTableProps) {
  const {project_id, maxRows, rows, loading} = props;

  // default for mobileView is on (collapsed table)
  const [mobileViewSwitchValue, setMobileViewSwitchValue] =
    React.useState(true);

  const theme = useTheme();
  const history = useNavigate();
  const not_xs = useMediaQuery(theme.breakpoints.up('sm'));

  // if screensize is > mobile, always set to false i.e., no mobile view. If mobile, allow control via the switch
  const mobileView: boolean = not_xs ? false : mobileViewSwitchValue;

  const defaultMaxRowsMobile = 10;

  const handleToggleMobileView = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setMobileViewSwitchValue(event.target.checked);
  };

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
      ? props.viewsets[params.row.type.toString()].label ?? params.row.type
      : params.row.type;
  }
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

  return (
    <React.Fragment>
      <Box component={Paper} elevation={0}>
        <DataGrid
          rows={rows}
          loading={loading}
          getRowId={r => r.record_id}
          columns={columns}
          autoHeight
          sx={{cursor: 'pointer'}}
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
      {not_xs ? (
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
      )}
    </React.Fragment>
  );
}

export function RecordsBrowseTable(props: RecordsBrowseTableProps) {
  const [query, setQuery] = React.useState('');
  const [pouchData, setPouchData] = React.useState(
    undefined as RecordMetadata[] | undefined
  );

  if (DEBUG_APP) {
    console.debug('Filter deleted?:', props.filter_deleted);
  }

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
    />
  );
}
RecordsBrowseTable.defaultProps = {
  maxRows: null,
};
