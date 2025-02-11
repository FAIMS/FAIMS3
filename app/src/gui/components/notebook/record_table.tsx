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

type ColumnType =
  | 'LAST_UPDATED'
  | 'LAST_UPDATED_BY'
  | 'CONFLICTS'
  | 'CREATED'
  | 'CREATED_BY';

const COLUMN_TO_LABEL_MAP: Map<ColumnType, string> = new Map([
  ['LAST_UPDATED', 'Last Updated'],
  ['LAST_UPDATED_BY', 'Last Updated By'],
  ['CONFLICTS', 'Conflicts'],
  ['CREATED', 'Created'],
  ['CREATED_BY', 'Created By'],
]);

const MANDATORY_COLUMNS: ColumnType[] = ['CREATED', 'CREATED_BY'];
const LARGE_COLUMNS = MANDATORY_COLUMNS.concat([
  'LAST_UPDATED',
  'LAST_UPDATED_BY',
]);

const MISSING_DATA_PLACEHOLDER = '-';
const HRID_COLUMN_LABEL = 'Field ID';

/**
 * Extracts and formats data from a record metadata object based on the specified column type.
 *
 * @param {Object} params - The parameters object
 * @param {RecordMetadata} params.record - The record metadata object to extract data from
 * @param {ColumnType} params.column - The type of column to get data for
 * @returns {string | undefined} The formatted string value for the column, or undefined if data is missing or invalid
 */
function getDataForColumn({
  record,
  column,
}: {
  record: RecordMetadata;
  column: ColumnType;
}): string | undefined {
  if (!record) return undefined;

  try {
    switch (column) {
      case 'LAST_UPDATED':
        return record.updated
          ? getLocalDate(record.updated).replace('T', ' ')
          : undefined;

      case 'LAST_UPDATED_BY':
        return record.updated_by || undefined;

      case 'CONFLICTS':
        return record.conflicts ? 'Yes' : 'No';

      case 'CREATED':
        return record.created
          ? getLocalDate(record.created).replace('T', ' ')
          : undefined;

      case 'CREATED_BY':
        return record.created_by || undefined;

      default:
        return undefined;
    }
  } catch (error) {
    console.warn(`Error getting data for column ${column}:`, error);
    return undefined;
  }
}

/**
 * Builds a list of column definitions from summary fields specified in the UI specification.
 *
 * @param {ProjectUIModel} params.uiSpecification - The UI specification for the project
 * @param {string[]} params.summaryFields - Array of field names to create columns for
 *
 * @returns {GridColDef<RecordMetadata>[]} Array of column definitions for the DataGrid
 */
function buildColumnsFromSummaryFields({
  summaryFields,
  uiSpecification,
}: {
  uiSpecification: ProjectUIModel;
  summaryFields: string[];
}): GridColDef<RecordMetadata>[] {
  if (!summaryFields || !uiSpecification) return [];

  return summaryFields.map(field => ({
    field: field,
    headerName: prettifyFieldName(field),
    type: 'string',
    filterable: true,
    flex: 1,
    renderCell: (params: GridCellParams) => {
      const displayValue = getDisplayDataFromRecordMetadata({
        field,
        data: params.row.data || {},
      });
      return (
        <Typography>{displayValue || MISSING_DATA_PLACEHOLDER}</Typography>
      );
    },
  }));
}

/**
 * Builds a column definition for a system-level column type.
 *
 * @param {ColumnType} params.columnType - The type of column to build
 * @returns {GridColDef<RecordMetadata>} Column definition for the DataGrid
 */
function buildColumnFromTypicalField({
  columnType,
}: {
  columnType: ColumnType;
}): GridColDef<RecordMetadata> {
  const baseColumn = {
    field: columnType.toLowerCase(),
    headerName: COLUMN_TO_LABEL_MAP.get(columnType) || columnType,
    type: 'string',
    flex: 1,
    filterable: true,
  };

  switch (columnType) {
    case 'LAST_UPDATED':
    case 'CREATED':
      return {
        ...baseColumn,
        type: 'dateTime',
        renderCell: (params: GridCellParams) => {
          const value = getDataForColumn({
            record: params.row,
            column: columnType,
          });
          return <Typography>{value || MISSING_DATA_PLACEHOLDER}</Typography>;
        },
      };

    case 'CONFLICTS':
      return {
        ...baseColumn,
        type: 'boolean',
        flex: 0,
        minWidth: 70,
        renderCell: (params: GridCellParams) => (
          <Box sx={{display: 'flex', alignItems: 'center'}}>
            {params.row.conflicts && (
              <WarningAmberIcon color="warning" sx={{marginRight: 1}} />
            )}
          </Box>
        ),
      };

    case 'LAST_UPDATED_BY':
    case 'CREATED_BY':
      return {
        ...baseColumn,
        renderCell: (params: GridCellParams) => {
          const value = getDataForColumn({
            record: params.row,
            column: columnType,
          });
          return <Typography>{value || MISSING_DATA_PLACEHOLDER}</Typography>;
        },
      };

    default:
      return baseColumn;
  }
}

/**
 * Converts record metadata field values to displayable strings.
 *
 * @param {Object} params - The parameters object
 * @param {string} params.field - The field name to extract from the data
 * @param {Object} params.data - The data object containing the field
 * @returns {string | undefined} A string representation of the field value, or undefined if:
 *   - The data object is undefined/null
 *   - The field doesn't exist in the data
 *   - The value cannot be converted to a meaningful string
 *
 * @example
 * // Returns "true"
 * getDisplayDataFromRecordMetadata({ field: "active", data: { active: true }})
 *
 * // Returns "1,2,3"
 * getDisplayDataFromRecordMetadata({ field: "numbers", data: { numbers: [1,2,3] }})
 *
 * // Returns undefined
 * getDisplayDataFromRecordMetadata({ field: "missing", data: { other: "value" }})
 */
function getDisplayDataFromRecordMetadata({
  field,
  data,
}: {
  field: string;
  data: {[key: string]: any};
}): string | undefined {
  try {
    // Handle undefined/null data object
    if (!data) return undefined;

    const value = data[field];

    // Handle undefined/null value
    if (value === undefined || value === null) return undefined;

    // Handle different types
    switch (typeof value) {
      case 'string':
        return value.trim() || undefined; // Return undefined if empty string
      case 'number':
        return Number.isFinite(value) ? value.toString() : undefined;
      case 'boolean':
        return value.toString();
      case 'object':
        if (Array.isArray(value)) {
          // Filter out null/undefined and join array elements
          return value.filter(item => item != null).join(', ') || undefined;
        }
        // For dates
        if (value instanceof Date) {
          return value.toISOString();
        }
        // For other objects, try JSON stringify if they're not too complex
        try {
          const str = JSON.stringify(value);
          return str === '{}' ? undefined : str;
        } catch {
          return undefined;
        }
      default:
        return undefined;
    }
  } catch (error) {
    console.warn(`Error formatting field ${field}:`, error);
    return undefined;
  }
}

/**
 * Builds a basic column definition for the HRID (Human Readable ID) field.
 *
 * @returns {GridColDef<RecordMetadata>} Column definition for the HRID field
 */
function buildHridColumn(): GridColDef<RecordMetadata> {
  return {
    field: 'hrid',
    headerName: 'Field ID',
    description: 'Human Readable Record ID',
    type: 'string',
    flex: 1,
    renderCell: (params: GridCellParams) => {
      return <Typography>{params.row.hrid}</Typography>;
    },
  };
}

/**
 * Given the summary fields and the column label to use, will build a column
 * definition for the small vertical stack record layout
 *
 * @param summaryFields The field names to use (we append mandatory to these)
 * @param columnLabel The column header label
 *
 * @returns A single column definition which renders a vertical stack of key
 * value pairs nicely
 */
function buildVerticalStackColumn({
  summaryFields,
  columnLabel,
}: {
  summaryFields: string[];
  columnLabel: string;
}): GridColDef<RecordMetadata> {
  return {
    field: 'summaryVerticalStack',
    headerName: columnLabel,
    type: 'string',
    filterable: true,
    flex: 1,
    renderCell: (params: GridCellParams) => {
      try {
        // Build a set of k,v fields to render vertically
        const kvp: {[fieldName: string]: string} = {};

        // Use the summary fields if present
        if (summaryFields.length > 0) {
          for (const summaryField of summaryFields) {
            // Get the value for this entry
            const val = getDisplayDataFromRecordMetadata({
              field: summaryField,
              data: params.row.data ?? {},
            });
            // And a pretty key
            const key = prettifyFieldName(summaryField);
            kvp[key] = val ?? MISSING_DATA_PLACEHOLDER;
          }
        } else {
          // Add the HRID if available
          kvp[HRID_COLUMN_LABEL] = params.row.hrid ?? MISSING_DATA_PLACEHOLDER;
        }

        for (const mandatoryField of MANDATORY_COLUMNS) {
          const key = COLUMN_TO_LABEL_MAP.get(mandatoryField) ?? 'Details';
          kvp[key] =
            getDataForColumn({
              record: params.row,
              column: mandatoryField,
            }) ?? MISSING_DATA_PLACEHOLDER;
        }
        return <KeyValueTable data={kvp} />;
      } catch (e) {
        console.warn(
          'Failed to render the vertical stack summary field, error: ',
          e
        );
        return 'Error';
      }
    },
  };
}

/**
 * Builds column definitions for the data grid based on UI specifications and screen width.
 *
 * @param {Object} params - The parameters object
 * @param {ProjectUIModel} params.uiSpecification - The UI specification for the project
 * @param {string} params.viewsetId - The ID of the current viewset
 * @param {('small' | 'medium' | 'large')} params.width - The screen width category
 * @returns {GridColDef<RecordMetadata>[]} Array of column definitions for the DataGrid
 *
 * @description
 * Generates columns based on screen width:
 * - Small: Shows a vertical stack of fields with basic information
 * - Medium: Shows summary fields (or HRID) plus mandatory columns
 * - Large: Shows all available columns including additional metadata
 */
function buildColumnDefinitions({
  uiSpecification,
  viewsetId,
  width,
}: {
  uiSpecification: ProjectUIModel;
  viewsetId: string;
  width: 'small' | 'medium' | 'large';
}): GridColDef<RecordMetadata>[] {
  // Get the UI spec information
  const summaryFieldInfo = getSummaryFieldInformation(
    uiSpecification,
    viewsetId
  );
  let columnList: GridColDef<RecordMetadata>[] = [];

  // Column generation based on width
  if (width === 'small') {
    // For small width, use vertical stack layout
    columnList.push(
      buildVerticalStackColumn({
        columnLabel: summaryFieldInfo.verticalStack?.columnLabel ?? 'Details',
        summaryFields: summaryFieldInfo.fieldNames,
      })
    );
  } else if (width === 'medium') {
    // For medium width, show summary fields or HRID, plus mandatory columns
    if (summaryFieldInfo.fieldNames.length > 0) {
      columnList = columnList.concat(
        buildColumnsFromSummaryFields({
          summaryFields: summaryFieldInfo.fieldNames,
          uiSpecification,
        })
      );
    } else {
      columnList.push(buildHridColumn());
    }

    // Add mandatory columns
    MANDATORY_COLUMNS.forEach(columnType => {
      columnList.push(
        buildColumnFromTypicalField({
          columnType,
        })
      );
    });
  } else if (width === 'large') {
    // For large width, include all columns
    if (summaryFieldInfo.fieldNames.length > 0) {
      columnList = columnList.concat(
        buildColumnsFromSummaryFields({
          summaryFields: summaryFieldInfo.fieldNames,
          uiSpecification,
        })
      );
    } else {
      columnList.push(buildHridColumn());
    }

    // Add all columns defined in LARGE_COLUMNS
    LARGE_COLUMNS.forEach(columnType => {
      columnList.push(
        buildColumnFromTypicalField({
          columnType,
        })
      );
    });
  }

  return columnList;
}

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
