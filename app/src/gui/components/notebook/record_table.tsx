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

import {
  ProjectID,
  ProjectUIModel,
  ProjectUIViewsets,
  RecordMetadata,
} from '@faims3/data-model';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  Alert,
  Box,
  Grid,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography,
} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  DataGrid,
  GridCellParams,
  GridColDef,
  GridEventListener,
} from '@mui/x-data-grid';
import React, {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';
import {
  getFieldLabel,
  getSummaryFieldInformation,
  getUiSpecForProject,
  getVisibleTypes,
} from '../../../uiSpecification';
import {prettifyFieldName} from '../../../utils/formUtilities';
import getLocalDate from '../../fields/LocalDate';
import {NotebookDataGridToolbar} from './datagrid_toolbar';

/**
 * A simple display for key value pair data - used in vertical summary stack
 * layout
 * @returns
 */
const KeyValueTable = ({data}: {data: {[key: string]: string}}) => {
  return (
    <TableContainer>
      <Table size="small">
        <TableBody>
          {Object.entries(data).map(([key, val]) => (
            <TableRow key={key}>
              <TableCell
                sx={{
                  width: '40%',
                  borderBottom: 'none',
                  padding: '4px 8px',
                  fontWeight: 'bold',
                }}
              >
                {key}
              </TableCell>
              <TableCell
                sx={{
                  width: '60%',
                  borderBottom: 'none',
                  padding: '4px 8px',
                }}
              >
                {val}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

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
  rows: RecordMetadata[] | undefined;
  loading: boolean;
  viewsets?: ProjectUIViewsets | null;
  handleQueryFunction: Function;
  handleRefresh: () => void;
  recordLabel: string;
};

/**
 * Component to render the records in a DataGrid table.
 *
 * @param {RecordsTableProps} props - The properties passed to the RecordsTable.
 * @returns {JSX.Element} The rendered DataGrid with record metadata.
 */
export function RecordsTable(props: RecordsTableProps) {
  const {project_id, maxRows, rows, loading} = props;
  const theme = useTheme();
  const history = useNavigate();

  // Determine whether the view is mobile or desktop based on screen size
  const not_xs = useMediaQuery(theme.breakpoints.up('sm'));
  const wideView = useMediaQuery(theme.breakpoints.up('lg'));
  const mobileView = !not_xs;
  const defaultMaxRowsMobile = 10;

  const [visibleTypes, setVisibleTypes] = useState<string[]>([]);
  const [uiSpec, setUISpec] = useState<ProjectUIModel | null>(null);

  useEffect(() => {
    const get = async () => {
      const ui = await getUiSpecForProject(project_id);
      setUISpec(ui);
      const visible = getVisibleTypes(ui);
      setVisibleTypes(visible);
    };

    get();
  }, [props.project_id]);

  // Filter rows so we only show records from visible_types if that is
  // configured Append the summaryVerticalStack property - this is added to each
  // row where needed
  let visible_rows = rows as (RecordMetadata & {
    summaryVerticalStack?: {[fieldName: string]: string};
  })[];
  if (rows && visibleTypes.length > 0) {
    visible_rows = rows.filter(
      (row: RecordMetadata) => visibleTypes.indexOf(row.type) >= 0
    );
  }

  /**
   * Redirects to the record detail view when a row is clicked.
   *
   * @param {GridEventListener<'rowClick'>} params - The row click event params.
   */
  const handleRowClick: GridEventListener<'rowClick'> = params => {
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

  const rowTypeColumn = {
    field: 'type',
    headerName: 'Kind',
    type: 'string',
    filterable: true,
    hide: true,
    minWidth: 70,
    valueGetter: getRowType,
  };

  const hridBasicColumn = {
    field: 'hrid',
    headerName: 'Field ID',
    description: 'Human Readable Record ID',
    type: 'string',
    minWidth: 70,
    flex: 1,
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
  };

  const hridDetailColumn = {
    field: 'hrid',
    headerName: 'Field ID',
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
            <Typography variant="body2" color="text.secondary">
              <strong>Field ID</strong>: {params.row.hrid}
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary">
              {params.row.updated ? (
                <>
                  <strong>Updated</strong>&nbsp;
                  {getLocalDate(params.row.updated).replace('T', ' ')}
                  <br />
                  <strong>by</strong> {params.row.updated_by}
                </>
              ) : (
                <>
                  <strong>Created</strong>&nbsp;
                  {getLocalDate(params.row.created).replace('T', ' ')}
                  <br />
                  <strong>by</strong> {params.row.created_by}
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
  };

  /**
   * Defines columns for the DataGrid, separate for mobile and desktop views.
   * - Desktop view has more columns and visual elements.
   * - Mobile view simplifies the table for smaller screens.
   */
  const columns = [];

  if (visibleTypes.length > 1) columns.push(rowTypeColumn);

  // if we have one visible type and summary fields we add these
  // to the table
  let summaryAdded = false;
  if (uiSpec && visibleTypes.length === 1) {
    const summaryFieldInfo = getSummaryFieldInformation(
      uiSpec,
      visibleTypes[0]
    );
    const summaryFields = summaryFieldInfo.enabled
      ? summaryFieldInfo.fieldNames
      : [];
    const isVerticalStackLayout = !!summaryFieldInfo.verticalStack;
    const summaryColumnLabel =
      summaryFieldInfo.verticalStack?.columnLabel ?? 'Label';

    if (summaryFields.length > 0) {
      summaryAdded = true;

      if (isVerticalStackLayout) {
        columns.push({
          field: 'summaryVerticalStack',
          headerName: summaryColumnLabel,
          type: 'string',
          filterable: true,
          minWidth: 200,
          flex: 3,
          renderCell: (params: GridCellParams) => {
            try {
              // Build a set of k,v fields to render vertically
              const summary: {[fieldName: string]: string} = {};
              for (const summaryField of summaryFields) {
                const val = params.row.data?.[summaryField];
                const key = prettifyFieldName(summaryField);
                const stringVal = val ? String(val) : undefined;
                if (stringVal && stringVal.length > 0) {
                  summary[key] = stringVal;
                } else {
                  summary[key] = '-';
                }
              }
              return <KeyValueTable data={summary} />;
            } catch (e) {
              console.warn(
                'Failed to render the vertical stack summary field, error: ',
                e
              );
              return 'Error';
            }
          },
        } as GridColDef);
      } else {
        // Typical layout
        summaryFields.forEach(field => {
          columns.push({
            field: field,
            headerName: getFieldLabel(uiSpec, field),
            type: 'string',
            filterable: true,
            minWidth: 70,
            flex: 1,
            renderCell: (params: GridCellParams) => {
              return (
                <Typography>
                  {params.row.data ? params.row.data[field] : 'missing'}
                </Typography>
              );
            },
          });
        });
      }
    }
  }
  // if we didn't add the summary fields, add the hrid field instead
  if (!summaryAdded) {
    if (mobileView) columns.push(hridDetailColumn);
    else columns.push(hridBasicColumn);
  }

  // add more columns for the wider view
  if (!mobileView) {
    columns.push({
      field: 'updated',
      headerName: 'Last Updated',
      type: 'dateTime',
      renderCell: (params: GridCellParams) => (
        <Typography>
          {params.row.updated &&
            getLocalDate(params.row.updated).replace('T', ' ')}
        </Typography>
      ),
      minWidth: 70,
      flex: 1,
      filterable: false,
    });
    columns.push({
      field: 'updated_by',
      headerName: 'Last Updated By',
      type: 'string',
      minWidth: 70,
      flex: 1,
      renderCell: (params: GridCellParams) => (
        <Typography>{params.row.updated_by}</Typography>
      ),
    });
    columns.push({
      field: 'conflicts',
      headerName: 'Conflicts',
      type: 'boolean',
      minWidth: 70,
      flex: 0,
      renderCell: (params: GridCellParams) => (
        <Box sx={{display: 'flex', alignItems: 'center'}}>
          {params.row.conflicts && (
            <WarningAmberIcon color="warning" sx={{marginRight: 1}} />
          )}
        </Box>
      ),
    });
    if (wideView) {
      columns.push({
        field: 'created',
        headerName: 'Created',
        type: 'dateTime',
        minWidth: 70,
        flex: 1,
      });
      columns.push({
        field: 'created_by',
        headerName: 'Created By',
        type: 'string',
        minWidth: 70,
        flex: 1,
      });
    }
  }

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
          // if rows are undefined - don't display any
          rows={visible_rows ?? []}
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
