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
  ProjectUIModel,
  ProjectUIViewsets,
  RecordMetadata,
} from '@faims3/data-model';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Theme,
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
import {ReactNode, useCallback, useMemo} from 'react';
import {useNavigate} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';
import {compiledSpecService} from '../../../context/slices/helpers/compiledSpecService';
import {Project} from '../../../context/slices/projectSlice';
import {
  getSummaryFieldInformation,
  getVisibleTypes,
} from '../../../uiSpecification';
import {prettifyFieldName} from '../../../utils/formUtilities';
import getLocalDate from '../../fields/LocalDate';
import CircularLoading from '../ui/circular_loading';
import {NotebookDataGridToolbar} from './datagrid_toolbar';

// ============================================================================
// Types & Interfaces
// ============================================================================

/** Screen size categories matching Material-UI breakpoints */
type SizeCategory = 'xs' | 'sm' | 'md' | 'lg';

/** Available system column types */
type ColumnType =
  | 'LAST_UPDATED'
  | 'LAST_UPDATED_BY'
  | 'CONFLICTS'
  | 'CREATED'
  | 'CREATED_BY'
  | 'KIND';

/** Props for the RecordsTable component */
interface RecordsTableProps {
  /** The project */
  project: Project;
  /** Max rows to display, or null for unlimited */
  maxRows: number | null;
  /** Array of record metadata objects */
  rows: RecordMetadata[] | undefined;
  /** Whether the table is in a loading state */
  loading: boolean;
  /** Optional viewsets configuration for the table */
  viewsets?: ProjectUIViewsets | null;
  /** Function to handle query changes */
  handleQueryFunction: Function;
  /** Function to handle table refresh */
  handleRefresh: () => void;
  /** Label for the record type */
  recordLabel: string;
}

// Column definition type
type GridColumnType = GridColDef<RecordMetadata>;

// ============================================================================
// Constants
// ============================================================================

/** Maps column types to their display labels */
const COLUMN_TO_LABEL_MAP: Map<ColumnType, string> = new Map([
  ['LAST_UPDATED', 'Last Updated'],
  ['LAST_UPDATED_BY', 'Last Updated By'],
  ['CONFLICTS', 'Conflicts'],
  ['CREATED', 'Created'],
  ['CREATED_BY', 'Created By'],
  ['KIND', 'Type'],
]);

/** Columns that must always be shown */
const MANDATORY_COLUMNS: ColumnType[] = ['CREATED', 'CREATED_BY'];

/** Columns to show in large view */
const LARGE_COLUMNS = MANDATORY_COLUMNS.concat([
  'LAST_UPDATED',
  'LAST_UPDATED_BY',
]);

/** Default values for text display and other constants */
const CONSTANTS = {
  MISSING_DATA_PLACEHOLDER: '-',
  HRID_COLUMN_LABEL: 'Field ID',
  VERTICAL_STACK_COLUMN_LABEL: 'Details',
} as const;

// ============================================================================
// Column Builder functions
// ============================================================================

/**
 * Extracts and formats data from a record metadata object based on the
 * specified column type.
 *
 * @param record The record to get data from
 * @param column The column type
 * @param uiSpecification ui Spec
 * @returns {string | undefined} The formatted string value for the column, or
 * undefined if data is missing or invalid
 */
function getDataForColumn({
  record,
  column,
  uiSpecification,
}: {
  record: RecordMetadata;
  column: ColumnType;
  uiSpecification: ProjectUIModel;
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

      case 'KIND':
        return uiSpecification.viewsets[record.type]?.label ?? record.type;

      default:
        return undefined;
    }
  } catch (error) {
    console.warn(`Error getting data for column ${column}:`, error);
    return undefined;
  }
}

/**
 * Builds a list of column definitions from summary fields specified in the UI
 * specification.
 *
 * @param summaryFields The list of fields to use as summary fields
 * @param uiSpecification The UI spec
 *
 * @returns {GridColumnType[]} Array of column definitions for the DataGrid
 */
function buildColumnsFromSummaryFields({
  summaryFields,
  uiSpecification,
}: {
  uiSpecification: ProjectUIModel;
  summaryFields: string[];
}): GridColumnType[] {
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
        <Typography>
          {displayValue || CONSTANTS.MISSING_DATA_PLACEHOLDER}
        </Typography>
      );
    },
  }));
}

/**
 * Builds a column definition for a system-level column type.
 *
 * @param columnType Type of column
 * @param uiSpecification The ui spec
 */
function buildColumnFromSystemField({
  columnType,
  uiSpecification,
}: {
  columnType: ColumnType;
  uiSpecification: ProjectUIModel;
}): GridColumnType {
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
            uiSpecification,
          });
          return (
            <Typography>
              {value || CONSTANTS.MISSING_DATA_PLACEHOLDER}
            </Typography>
          );
        },
      };
    case 'KIND':
    case 'LAST_UPDATED_BY':
    case 'CREATED_BY':
      return {
        ...baseColumn,
        type: 'string',
        renderCell: (params: GridCellParams) => {
          const value = getDataForColumn({
            record: params.row,
            column: columnType,
            uiSpecification,
          });
          return (
            <Typography>
              {value || CONSTANTS.MISSING_DATA_PLACEHOLDER}
            </Typography>
          );
        },
      };
    case 'CONFLICTS':
      return {
        ...baseColumn,
        type: 'boolean',
        flex: 0,
        minWidth: 125,
        renderCell: (params: GridCellParams) => (
          <Box sx={{display: 'flex', alignItems: 'center'}}>
            {params.row.conflicts && (
              <WarningAmberIcon color="warning" sx={{marginRight: 1}} />
            )}
          </Box>
        ),
      };

    default:
      return baseColumn;
  }
}

/**
 * Converts record metadata field values to displayable strings.
 *
 * @param field - The field name to extract from the data
 * @param data - The data object containing the field
 * @returns {string | undefined} A string representation of the field value, or undefined if:
 *   - The data object is undefined/null
 *   - The field doesn't exist in the data
 *   - The value cannot be converted to a meaningful string
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
          return value.filter(item => item !== null).join(', ') || undefined;
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
 * @returns {GridColumnType} Column definition for the HRID field
 */
function buildHridColumn(): GridColumnType {
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
 * @param summaryFields - the summary fields to use if any
 * @param columnLabel - The label for the column
 * @param uiSpecification - UI spec
 * @param includeKind - should we include the record type/kind?
 * @param hasConflict - does any record have a conflict? (Triggers a check - in
 * column layout this always adds it, here it only adds if === Yes)
 *
 * @returns A single column definition which renders a vertical stack of key
 * value pairs nicely
 */
function buildVerticalStackColumn({
  summaryFields,
  columnLabel,
  uiSpecification,
  includeKind,
  hasConflict,
}: {
  summaryFields: string[];
  uiSpecification: ProjectUIModel;
  columnLabel: string;
  includeKind: boolean;
  hasConflict: boolean;
}): GridColumnType {
  return {
    field: 'summaryVerticalStack',
    headerName: columnLabel,
    type: 'string',
    filterable: true,
    flex: 1,
    renderCell: (params: GridCellParams) => {
      try {
        // Build a set of k,v fields to render vertically
        const kvp: {[fieldName: string]: string | ReactNode} = {};

        // Add the kind property if needed (put this first)
        if (includeKind) {
          const val = getDataForColumn({
            column: 'KIND',
            record: params.row,
            uiSpecification,
          });
          // And a pretty key
          kvp[COLUMN_TO_LABEL_MAP.get('KIND') ?? 'Type'] =
            val ?? CONSTANTS.MISSING_DATA_PLACEHOLDER;
        }

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
            kvp[key] = val ?? CONSTANTS.MISSING_DATA_PLACEHOLDER;
          }
        } else {
          // Add the HRID if available
          kvp[CONSTANTS.HRID_COLUMN_LABEL] =
            params.row.hrid ?? CONSTANTS.MISSING_DATA_PLACEHOLDER;
        }

        for (const mandatoryField of MANDATORY_COLUMNS) {
          const key = COLUMN_TO_LABEL_MAP.get(mandatoryField) ?? 'Details';
          kvp[key] =
            getDataForColumn({
              record: params.row,
              column: mandatoryField,
              uiSpecification,
            }) ?? CONSTANTS.MISSING_DATA_PLACEHOLDER;
        }

        // Add the conflict field if there is a conflict
        if (hasConflict) {
          const val = getDataForColumn({
            column: 'CONFLICTS',
            record: params.row,
            uiSpecification,
          });
          // Only put this in if necessary
          if (val === 'Yes') {
            // And a pretty key
            kvp[COLUMN_TO_LABEL_MAP.get('CONFLICTS') ?? 'Conflicts'] = (
              <WarningAmberIcon color="warning" sx={{marginRight: 1}} />
            );
          }
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
 * @param uiSpecification Ui spec
 * @param viewsetId the viewset relevant (if known/single entity type)
 * @param width the screen size
 * @param includeKind should we include record type in relevant display
 * @param hasConflict does any item have a conflict? If so include column for it
 *
 * @returns {GridColumnType[]} Array of column definitions for the DataGrid
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
  includeKind,
  hasConflict,
}: {
  uiSpecification: ProjectUIModel;
  viewsetId?: string;
  width: SizeCategory;
  includeKind: boolean;
  hasConflict: boolean;
}): GridColumnType[] {
  // Get the UI spec information
  let summaryFields: string[] = [];

  // Only try to fetch summary fields when we actually have a viewsetID
  if (viewsetId) {
    summaryFields = getSummaryFieldInformation(
      uiSpecification,
      viewsetId
    ).fieldNames;
  }
  let columnList: GridColumnType[] = [];

  // Column generation based on width
  if (width === 'xs' || width === 'sm') {
    // For small width, use vertical stack layout
    columnList.push(
      buildVerticalStackColumn({
        columnLabel: CONSTANTS.VERTICAL_STACK_COLUMN_LABEL,
        summaryFields,
        uiSpecification,
        includeKind,
        hasConflict,
      })
    );
  } else if (width === 'md') {
    // For medium width, show summary fields or HRID, plus mandatory columns

    // Add kind column (if needed)
    if (includeKind) {
      columnList.push(
        buildColumnFromSystemField({
          columnType: 'KIND',
          uiSpecification,
        })
      );
    }
    if (summaryFields.length > 0) {
      columnList = columnList.concat(
        buildColumnsFromSummaryFields({
          summaryFields,
          uiSpecification,
        })
      );
    } else {
      columnList.push(buildHridColumn());
    }

    // Add mandatory columns
    MANDATORY_COLUMNS.forEach(columnType => {
      columnList.push(
        buildColumnFromSystemField({
          columnType,
          uiSpecification,
        })
      );
    });
    // Add conflict column if needed
    if (hasConflict) {
      columnList.push(
        buildColumnFromSystemField({columnType: 'CONFLICTS', uiSpecification})
      );
    }
  } else if (width === 'lg') {
    // Add kind column (if needed)
    if (includeKind) {
      columnList.push(
        buildColumnFromSystemField({
          columnType: 'KIND',
          uiSpecification,
        })
      );
    }

    // For large width, include all columns
    if (summaryFields.length > 0) {
      columnList = columnList.concat(
        buildColumnsFromSummaryFields({
          summaryFields,
          uiSpecification,
        })
      );
    } else {
      columnList.push(buildHridColumn());
    }

    // Add all columns defined in LARGE_COLUMNS
    LARGE_COLUMNS.forEach(columnType => {
      columnList.push(
        buildColumnFromSystemField({
          columnType,
          uiSpecification,
        })
      );
    });

    // Add conflict column if needed
    if (hasConflict) {
      columnList.push(
        buildColumnFromSystemField({columnType: 'CONFLICTS', uiSpecification})
      );
    }
  }

  return columnList;
}

/**
 * A simple display for key value pair data - used in vertical summary stack
 * layout
 * @returns
 */
const KeyValueTable = ({data}: {data: {[key: string]: string | ReactNode}}) => {
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
                }}
              >
                {key}
              </TableCell>
              <TableCell
                sx={{
                  width: '60%',
                  borderBottom: 'none',
                  padding: '4px 8px',
                  fontWeight: 'bold',
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

// ============================================================================
// Custom Hooks
// ============================================================================

/**
 * Custom hook for responsive screen size management
 * Provides screen size category and pagination settings based on viewport size
 */
const useScreenSize = () => {
  const theme = useTheme();

  const isXs = useMediaQuery(theme.breakpoints.only('xs'));
  const isSm = useMediaQuery(theme.breakpoints.only('sm'));
  const isMd = useMediaQuery(theme.breakpoints.only('md'));

  const currentSize = useMemo((): SizeCategory => {
    if (isXs) return 'xs';
    if (isSm) return 'sm';
    if (isMd) return 'md';
    return 'lg';
  }, [isXs, isSm, isMd]);

  const pageSize = useMemo(() => {
    const sizeMap: Record<SizeCategory, number> = {
      xs: 10,
      sm: 15,
      md: 20,
      lg: 25,
    };

    return (maxRows: number | null) =>
      maxRows !== null
        ? Math.min(maxRows, sizeMap[currentSize])
        : sizeMap[currentSize];
  }, [currentSize]);

  return {currentSize, pageSize};
};

/**
 * Manages column definitions based on UI specifications and screen size
 */
const useTableColumns = ({
  uiSpec,
  visibleTypes,
  viewsets,
  size,
  hasConflict,
}: {
  uiSpec: ProjectUIModel | null;
  visibleTypes: string[];
  viewsets: ProjectUIViewsets | null | undefined;
  size: SizeCategory;
  hasConflict: boolean;
}) => {
  return useMemo(() => {
    if (!uiSpec) return [];
    const cols: GridColumnType[] = [];

    // Should the kind property be included?
    const includeKind = visibleTypes.length > 1;
    const viewsetId = visibleTypes.length === 1 ? visibleTypes[0] : '';
    return cols.concat(
      buildColumnDefinitions({
        uiSpecification: uiSpec,
        viewsetId,
        width: size,
        includeKind,
        hasConflict,
      })
    );
  }, [uiSpec, visibleTypes, viewsets, size, hasConflict]);
};

/**
 * Manages row filtering based on visible types.
 * Specifies whether any row has conflicts.
 */
const useTableRows = (
  rows: RecordMetadata[] | undefined,
  visibleTypes: string[]
) => {
  return useMemo(() => {
    let relevantRows: RecordMetadata[] = [];
    if (!rows) {
      relevantRows = [];
    } else if (visibleTypes.length === 0) {
      relevantRows = rows;
    } else {
      relevantRows = rows.filter(row => visibleTypes.includes(row.type));
    }
    return {
      rows: relevantRows,
      hasConflict: relevantRows.some(r => {
        return r.conflicts;
      }),
    };
  }, [rows, visibleTypes]);
};

/**
 * Data grid styling
 */
const useDataGridStyles = (theme: Theme) => ({
  root: {
    border: 'none',
  },
  wrapper: {
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
  },
  grid: {
    cursor: 'pointer',
    // Header styling
    '& .MuiDataGrid-columnHeaders': {
      backgroundColor: theme.palette.grey[100],
      borderBottom: `2px solid ${theme.palette.grey[200]}`,
      minHeight: '60px !important',
      '& .MuiDataGrid-columnHeader': {
        padding: '16px 24px',
        '&:focus': {
          outline: 'none',
        },
        '&:focus-within': {
          outline: 'none',
        },
      },
      '& .MuiDataGrid-columnHeaderTitle': {
        fontWeight: 600,
        fontSize: '0.95rem',
        color: theme.palette.text.primary,
        letterSpacing: '0.01em',
      },
      '& .MuiDataGrid-columnSeparator': {
        display: 'none',
      },
      '& .MuiDataGrid-sortIcon': {
        color: theme.palette.text.secondary,
        opacity: 1,
      },
    },
    // Row and cell styling
    '& .MuiDataGrid-row': {
      minHeight: '80px !important',
      '&:hover': {
        backgroundColor: theme.palette.action.hover,
        transition: 'background-color 0.2s ease',
      },
      '&.conflict-row': {
        backgroundColor: theme.palette.warning.light,
        '&:hover': {
          backgroundColor: theme.palette.warning.light,
          opacity: 0.95,
        },
      },
    },
    '& .MuiDataGrid-cell': {
      padding: '16px 24px',
      borderBottom: `1px solid ${theme.palette.divider}`,
      '&:focus': {
        outline: 'none',
      },
      '&:focus-within': {
        outline: 'none',
      },
    },
    // Footer styling
    '& .MuiDataGrid-footerContainer': {
      minHeight: '56px',
      padding: '8px 16px',
      borderTop: `1px solid ${theme.palette.divider}`,
      backgroundColor: theme.palette.background.paper,
    },
    // Pagination styling
    '& .MuiTablePagination-root': {
      color: theme.palette.text.secondary,
      '& .MuiTablePagination-select': {
        marginRight: 2,
      },
      '& .MuiTablePagination-selectLabel': {
        marginRight: 8,
      },
      '& .MuiTablePagination-displayedRows': {
        marginLeft: 8,
      },
    },
    // Typography within cells
    '& .MuiTypography-root': {
      lineHeight: 1.5,
    },
    // Responsive adjustments
    [theme.breakpoints.down('sm')]: {
      '& .MuiDataGrid-columnHeaders': {
        '& .MuiDataGrid-columnHeader': {
          padding: '12px 16px',
        },
      },
      '& .MuiDataGrid-cell': {
        padding: '12px 16px',
      },
    },
  },
});

// ============================================================================
// Main Component
// ============================================================================

/**
 * MUI Data Grid based RecordsTable Component
 *
 * Supports different views based on screen size.
 */
export function RecordsTable(props: RecordsTableProps) {
  const {
    maxRows,
    rows,
    loading,
    viewsets,
    project: {uiSpecificationId: uiSpecId, projectId: project_id, serverId},
  } = props;
  const theme = useTheme();
  const history = useNavigate();
  const styles = useDataGridStyles(theme);
  const uiSpec = compiledSpecService.getSpec(uiSpecId);
  if (!uiSpec) {
    return <CircularLoading label="Loading" />;
  }

  const visibleTypes = useMemo(() => {
    return getVisibleTypes(uiSpec);
  }, [uiSpec]);

  // Screen size and responsive management
  const {currentSize, pageSize} = useScreenSize();

  // Column and row management
  const {rows: visibleRows, hasConflict} = useTableRows(rows, visibleTypes);
  const columns = useTableColumns({
    uiSpec,
    visibleTypes,
    viewsets,
    size: currentSize,
    hasConflict,
  });

  // Event handlers
  const handleRowClick = useCallback<GridEventListener<'rowClick'>>(
    params => {
      history(
        ROUTES.getRecordRoute(
          serverId,
          project_id || 'dummy',
          (params.row.record_id || '').toString(),
          (params.row.revision_id || '').toString()
        )
      );
    },
    [history, project_id]
  );

  return (
    <Box component={Paper} elevation={3} sx={styles.wrapper}>
      <DataGrid
        rows={visibleRows}
        loading={loading}
        getRowId={r => r.record_id}
        columns={columns}
        autoHeight
        getRowHeight={() => 'auto'}
        pageSizeOptions={[10, 15, 20, 25, 50, 100]}
        disableRowSelectionOnClick
        onRowClick={handleRowClick}
        getRowClassName={params => (params.row.conflicts ? 'conflict-row' : '')}
        slots={{toolbar: NotebookDataGridToolbar}}
        slotProps={{
          filterPanel: {sx: {maxWidth: '96vw'}},
          toolbar: {handleQueryFunction: props.handleQueryFunction},
        }}
        initialState={{
          sorting: {sortModel: [{field: 'created', sort: 'desc'}]},
          pagination: {paginationModel: {pageSize: pageSize(maxRows)}},
        }}
        sx={styles.grid}
      />
    </Box>
  );
}
