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
  PostRecordStatusResponse,
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
  Typography,
} from '@mui/material';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import PendingIcon from '@mui/icons-material/Pending';
import {useTheme} from '@mui/material/styles';
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
import {useDataGridStyles} from '../../../utils/useDataGridStyles';
import {useScreenSize} from '../../../utils/useScreenSize';
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
  | 'KIND'
  | 'SYNC_STATUS';

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
  /** Record Sync status data if available */
  recordStatus?: PostRecordStatusResponse;
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
  ['SYNC_STATUS', 'Sync'],
]);

/** Columns that must always be shown */
const MANDATORY_COLUMNS: ColumnType[] = ['CREATED', 'CREATED_BY'];

/** Columns to show in large view */
const LARGE_COLUMNS = MANDATORY_COLUMNS.concat([
  'LAST_UPDATED',
  'LAST_UPDATED_BY',
]);

/** Default values for text display , record grid labels */
export const RECORD_GRID_LABELS = {
  MISSING_DATA_PLACEHOLDER: '-',
  HRID_COLUMN_LABEL: 'ID',
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

      case 'SYNC_STATUS':
        return record.synced ? 'synced' : 'pending';

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
export function buildColumnsFromSummaryFields({
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
          {displayValue || RECORD_GRID_LABELS.MISSING_DATA_PLACEHOLDER}
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
export function buildColumnFromSystemField({
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
      return {
        ...baseColumn,
        type: 'dateTime',
        sortable: true,
        valueGetter: params => {
          const rawValue = params.row.updated;
          return rawValue ? new Date(rawValue) : null;
        },
        sortComparator: (v1, v2) => {
          return new Date(v1).getTime() - new Date(v2).getTime();
        },
        renderCell: (params: GridCellParams) => {
          const value = getDataForColumn({
            record: params.row,
            column: columnType,
            uiSpecification,
          });
          return (
            <Typography>
              {value || RECORD_GRID_LABELS.MISSING_DATA_PLACEHOLDER}
            </Typography>
          );
        },
      };

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
              {value || RECORD_GRID_LABELS.MISSING_DATA_PLACEHOLDER}
            </Typography>
          );
        },
      };
    case 'SYNC_STATUS':
      return {
        ...baseColumn,
        type: 'string',
        renderCell: (params: GridCellParams) => {
          const sync = getDataForColumn({
            record: params.row,
            column: columnType,
            uiSpecification,
          });
          return sync === 'synced' ? (
            <CloudDoneIcon color="success"></CloudDoneIcon>
          ) : (
            <PendingIcon color="warning"></PendingIcon>
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
              {value || RECORD_GRID_LABELS.MISSING_DATA_PLACEHOLDER}
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
export function buildVerticalStackColumn({
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
            val ?? RECORD_GRID_LABELS.MISSING_DATA_PLACEHOLDER;
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
            kvp[key] = val ?? RECORD_GRID_LABELS.MISSING_DATA_PLACEHOLDER;
          }
        } else {
          // Add the HRID if available
          kvp[RECORD_GRID_LABELS.HRID_COLUMN_LABEL] =
            params.row.hrid ?? RECORD_GRID_LABELS.MISSING_DATA_PLACEHOLDER;
        }

        for (const mandatoryField of MANDATORY_COLUMNS) {
          const key = COLUMN_TO_LABEL_MAP.get(mandatoryField) ?? 'Details';
          kvp[key] =
            getDataForColumn({
              record: params.row,
              column: mandatoryField,
              uiSpecification,
            }) ?? RECORD_GRID_LABELS.MISSING_DATA_PLACEHOLDER;
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

        // Add sync status field
        const sync = getDataForColumn({
          column: 'SYNC_STATUS',
          record: params.row,
          uiSpecification,
        });
        kvp['Sync Status'] =
          sync === 'synced' ? (
            <CloudDoneIcon color="success"></CloudDoneIcon>
          ) : (
            <PendingIcon color="warning"></PendingIcon>
          );

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
        columnLabel: RECORD_GRID_LABELS.VERTICAL_STACK_COLUMN_LABEL,
        summaryFields,
        uiSpecification,
        includeKind,
        hasConflict,
      })
    );
  } else if (width === 'md') {
    // For medium width, show summary fields or HRID, plus mandatory columns

    // Add sync status field
    columnList.push(
      buildColumnFromSystemField({
        columnType: 'SYNC_STATUS',
        uiSpecification,
      })
    );

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

    // Add sync status field
    columnList.push(
      buildColumnFromSystemField({
        columnType: 'SYNC_STATUS',
        uiSpecification,
      })
    );

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
export const KeyValueTable = ({
  data,
}: {
  data: {[key: string]: string | ReactNode};
}) => {
  return (
    <TableContainer>
      <Table size="small">
        <TableBody>
          {Object.entries(data).map(([key, val]) => (
            <TableRow key={key}>
              <TableCell
                sx={{
                  minWidth: '40%',
                  borderBottom: 'none',
                  padding: '4px 8px',
                  textAlign: 'right',
                }}
              >
                {key}
              </TableCell>
              <TableCell
                sx={{
                  maxWidth: '60%',
                  borderBottom: 'none',
                  padding: '4px 8px',
                  fontWeight: 'bold',
                  textAlign: 'left',
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
  visibleTypes: string[],
  recordStatus: PostRecordStatusResponse | undefined
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
    // add status information if available
    if (recordStatus) {
      relevantRows = relevantRows.map(row => {
        const synced = recordStatus.status[row.record_id];
        return {
          ...row,
          synced,
        };
      });
    }

    return {
      rows: relevantRows,
      hasConflict: relevantRows.some(r => {
        return r.conflicts;
      }),
    };
  }, [rows, visibleTypes, recordStatus]);
};

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
    recordStatus,
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
  const {rows: visibleRows, hasConflict} = useTableRows(
    rows,
    visibleTypes,
    recordStatus
  );
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
        ROUTES.getExistingRecordRoute({
          serverId,
          projectId: project_id,
          recordId: (params.row.record_id || '').toString(),
          revisionId: (params.row.revision_id || '').toString(),
        })
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
          sorting: {sortModel: [{field: 'last_updated', sort: 'desc'}]},
          pagination: {paginationModel: {pageSize: pageSize(maxRows)}},
        }}
        sx={styles.grid}
      />
    </Box>
  );
}
