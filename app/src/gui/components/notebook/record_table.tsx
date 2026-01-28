import {
  DataDbType,
  fetchAndHydrateRecord,
  getSummaryFieldInformation,
  getVisibleTypes,
  MinimalRecordMetadata,
  PostRecordStatusResponse,
  ProjectUIModel,
  ProjectUIViewsets,
  RecordMetadata,
} from '@faims3/data-model';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import PendingIcon from '@mui/icons-material/Pending';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography,
} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import {
  DataGrid,
  GridCellParams,
  GridColDef,
  GridEventListener,
} from '@mui/x-data-grid';
import {useQueries} from '@tanstack/react-query';
import {ReactNode, useCallback, useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';
import {selectActiveUser} from '../../../context/slices/authSlice';
import {compiledSpecService} from '../../../context/slices/helpers/compiledSpecService';
import {Project} from '../../../context/slices/projectSlice';
import {useAppSelector} from '../../../context/store';
import {buildHydrateKeys} from '../../../utils/customHooks';
import {localGetDataDb} from '../../../utils/database';
import {prettifyFieldName} from '../../../utils/formUtilities';
import {useDataGridStyles} from '../../../utils/useDataGridStyles';
import {useScreenSize} from '../../../utils/useScreenSize';
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

/**
 * Available sort options for the records table.
 * These are based on fields available in UnhydratedRecord (no hydration needed).
 */
type SortOption =
  | 'updated_desc'
  | 'updated_asc'
  | 'created_desc'
  | 'created_asc'
  | 'created_by_asc'
  | 'created_by_desc'
  | 'updated_by_asc'
  | 'updated_by_desc'
  | 'type_asc'
  | 'type_desc';

/** Configuration for a sort option */
interface SortConfig {
  /** Display label for the dropdown */
  label: string;
  /** Field to sort by (must exist on UnhydratedRecord) */
  field: keyof MinimalRecordMetadata;
  /** Sort direction */
  direction: 'asc' | 'desc';
}

/** Props for the RecordsTable component */
interface RecordsTableProps {
  /** The project */
  project: Project;
  /** Max rows to display, or null for unlimited */
  maxRows: number | null;
  /** Array of record metadata objects */
  rows: MinimalRecordMetadata[] | undefined;
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

/** Props for the sort control component */
interface SortControlProps {
  /** Currently selected sort option */
  value: SortOption;
  /** Callback when sort option changes */
  onChange: (option: SortOption) => void;
}

// Column definition type
type GridColumnType = GridColDef<RecordMetadata | MinimalRecordMetadata>;

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

/** Default values for text display, record grid labels */
export const RECORD_GRID_LABELS = {
  MISSING_DATA_PLACEHOLDER: '-',
  HRID_COLUMN_LABEL: 'ID',
  VERTICAL_STACK_COLUMN_LABEL: 'Details',
} as const;

/**
 * Configuration for all available sort options.
 * Maps sort option keys to their display labels and sort parameters.
 */
const SORT_OPTIONS: Record<SortOption, SortConfig> = {
  updated_desc: {
    label: 'Recently Updated',
    field: 'updated',
    direction: 'desc',
  },
  updated_asc: {
    label: 'Oldest Updated',
    field: 'updated',
    direction: 'asc',
  },
  created_desc: {
    label: 'Recently Created',
    field: 'created',
    direction: 'desc',
  },
  created_asc: {
    label: 'Oldest Created',
    field: 'created',
    direction: 'asc',
  },
  created_by_asc: {
    label: 'Created By (A-Z)',
    field: 'createdBy',
    direction: 'asc',
  },
  created_by_desc: {
    label: 'Created By (Z-A)',
    field: 'createdBy',
    direction: 'desc',
  },
  updated_by_asc: {
    label: 'Updated By (A-Z)',
    field: 'updatedBy',
    direction: 'asc',
  },
  updated_by_desc: {
    label: 'Updated By (Z-A)',
    field: 'updatedBy',
    direction: 'desc',
  },
  type_asc: {
    label: 'Type (A-Z)',
    field: 'type',
    direction: 'asc',
  },
  type_desc: {
    label: 'Type (Z-A)',
    field: 'type',
    direction: 'desc',
  },
};

/** Default sort option */
const DEFAULT_SORT: SortOption = 'updated_desc';

// ============================================================================
// Sort Control Component
// ============================================================================

/**
 * Dropdown control for selecting sort order.
 * Renders a Material-UI Select with all available sort options.
 */
function SortControl({value, onChange}: SortControlProps) {
  const handleChange = (event: SelectChangeEvent<SortOption>) => {
    onChange(event.target.value as SortOption);
  };

  return (
    <FormControl size="small" sx={{minWidth: 180}}>
      <InputLabel id="sort-select-label">
        <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
          Sort By
        </Box>
      </InputLabel>
      <Select<SortOption>
        labelId="sort-select-label"
        id="sort-select"
        value={value}
        label="Sort By"
        onChange={handleChange}
      >
        {Object.entries(SORT_OPTIONS).map(([key, config]) => (
          <MenuItem key={key} value={key}>
            {config.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

// ============================================================================
// Column Builder functions
// ============================================================================

type WithSynced<T> = T & {synced?: boolean};

/**
 * Extracts and formats data from a record metadata object based on the
 * specified column type.
 *
 * @param record - The record to get data from
 * @param column - The column type
 * @param uiSpecification - UI specification for label lookups
 * @returns The formatted string value for the column, or a fallback ('-') if
 *          data is missing or invalid
 */
function getDataForColumn({
  record,
  column,
  uiSpecification,
}: {
  record: WithSynced<RecordMetadata | MinimalRecordMetadata>;
  column: ColumnType;
  uiSpecification: ProjectUIModel;
}): string | undefined {
  const fallback = RECORD_GRID_LABELS.MISSING_DATA_PLACEHOLDER;
  if (!record) return fallback;

  try {
    if ('createdBy' in record) {
      switch (column) {
        case 'LAST_UPDATED':
          return record.updated
            ? record.updated.toLocaleString().replace('T', ' ')
            : fallback;

        case 'LAST_UPDATED_BY':
          return record.updatedBy || fallback;

        case 'CONFLICTS':
          return record.conflicts ? 'Yes' : 'No';

        case 'CREATED':
          return record.created
            ? record.created.toLocaleString().replace('T', ' ')
            : fallback;

        case 'CREATED_BY':
          return record.createdBy || fallback;

        case 'KIND':
          return uiSpecification.viewsets[record.type]?.label ?? record.type;

        case 'SYNC_STATUS':
          return record.synced ? 'synced' : 'pending';

        default:
          return fallback;
      }
    } else {
      switch (column) {
        case 'LAST_UPDATED':
          return record.updated
            ? record.updated.toLocaleString().replace('T', ' ')
            : fallback;

        case 'LAST_UPDATED_BY':
          return record.updated_by || fallback;

        case 'CONFLICTS':
          return record.conflicts ? 'Yes' : 'No';

        case 'CREATED':
          return record.created
            ? record.created.toLocaleString().replace('T', ' ')
            : fallback;

        case 'CREATED_BY':
          return record.created_by || fallback;

        case 'KIND':
          return uiSpecification.viewsets[record.type]?.label ?? record.type;

        case 'SYNC_STATUS':
          return record.synced ? 'synced' : 'pending';

        default:
          return fallback;
      }
    }
  } catch (error) {
    console.warn(`Error getting data for column ${column}:`, error);
    return fallback;
  }
}

/**
 * Builds a list of column definitions from summary fields specified in the UI
 * specification.
 *
 * @param summaryFields - The list of fields to use as summary fields
 * @param uiSpecification - The UI spec
 * @returns Array of column definitions for the DataGrid
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
    sortable: false,
    headerName: prettifyFieldName(field),
    type: 'string',
    filterable: false,
    flex: 1,
    valueGetter: params => {
      const data = 'data' in params.row ? (params.row.data ?? {}) : {};
      return getDisplayDataFromRecordMetadata({
        field,
        data: data,
      });
    },
  }));
}

/**
 * Builds a column definition for a system-level column type.
 *
 * @param columnType - Type of column to build
 * @param uiSpecification - The UI specification
 * @returns Column definition for the DataGrid
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
    sortable: false,
    flex: 1,
    filterable: false,
  };

  switch (columnType) {
    case 'LAST_UPDATED':
      return {
        ...baseColumn,
        type: 'dateTime',
        valueGetter: params => {
          const rawValue = params.row.updated;
          return rawValue ? new Date(rawValue) : null;
        },
      };

    case 'CREATED':
      return {
        ...baseColumn,
        type: 'string',
        valueGetter: params => {
          return getDataForColumn({
            record: params.row,
            column: columnType,
            uiSpecification,
          });
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
            <CloudDoneIcon color="success" />
          ) : (
            <PendingIcon color="warning" />
          );
        },
      };

    case 'KIND':
    case 'LAST_UPDATED_BY':
    case 'CREATED_BY':
      return {
        ...baseColumn,
        type: 'string',
        valueGetter: params => {
          return getDataForColumn({
            record: params.row,
            column: columnType,
            uiSpecification,
          });
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
 * @returns A string representation of the field value, or a fallback value if
 *          the data is missing or cannot be converted
 */
function getDisplayDataFromRecordMetadata({
  field,
  data,
}: {
  field: string;
  data: {[key: string]: any};
}): string {
  const fallback = RECORD_GRID_LABELS.MISSING_DATA_PLACEHOLDER;
  try {
    if (!data) return fallback;

    const value = data[field];

    if (value === undefined || value === null) return fallback;

    switch (typeof value) {
      case 'string':
        return value.trim() || fallback;
      case 'number':
        return Number.isFinite(value) ? value.toString() : fallback;
      case 'boolean':
        return value.toString();
      case 'object':
        if (Array.isArray(value)) {
          return value.filter(item => item !== null).join(', ') || fallback;
        }
        if (value instanceof Date) {
          return value.toISOString();
        }
        try {
          const str = JSON.stringify(value);
          return str === '{}' ? fallback : str;
        } catch {
          return fallback;
        }
      default:
        return fallback;
    }
  } catch (error) {
    console.warn(`Error formatting field ${field}:`, error);
    return fallback;
  }
}

/**
 * Builds a basic column definition for the HRID (Human Readable ID) field.
 *
 * @returns Column definition for the HRID field
 */
function buildHridColumn(): GridColumnType {
  return {
    field: 'hrid',
    headerName: 'Field ID',
    description: 'Human Readable Record ID',
    type: 'string',
    sortable: false,
    filterable: false,
    flex: 1,
    renderCell: (params: GridCellParams) => {
      return <Typography>{params.row.hrid}</Typography>;
    },
  };
}

/**
 * Builds a column definition for the small vertical stack record layout.
 * This is used on small screens to show multiple fields stacked vertically
 * in a single column.
 *
 * @param summaryFields - The summary fields to display
 * @param columnLabel - The label for the column header
 * @param uiSpecification - UI specification for label lookups
 * @param includeKind - Whether to include the record type/kind
 * @param hasConflict - Whether any record has a conflict (shows warning icon)
 * @returns A single column definition with vertical key-value layout
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
    filterable: false,
    flex: 1,
    sortable: false,
    renderCell: (params: GridCellParams) => {
      try {
        const kvp: {[fieldName: string]: string | ReactNode} = {};

        // Add the kind property if needed (put this first)
        if (includeKind) {
          const val = getDataForColumn({
            column: 'KIND',
            record: params.row,
            uiSpecification,
          });
          kvp[COLUMN_TO_LABEL_MAP.get('KIND') ?? 'Type'] =
            val ?? RECORD_GRID_LABELS.MISSING_DATA_PLACEHOLDER;
        }

        // Use the summary fields if present
        if (summaryFields.length > 0) {
          for (const summaryField of summaryFields) {
            const val = getDisplayDataFromRecordMetadata({
              field: summaryField,
              data: params.row.data ?? {},
            });
            const key = prettifyFieldName(summaryField);
            kvp[key] = val ?? RECORD_GRID_LABELS.MISSING_DATA_PLACEHOLDER;
          }
        } else {
          // Add the HRID if available
          kvp[RECORD_GRID_LABELS.HRID_COLUMN_LABEL] =
            params.row.hrid ?? RECORD_GRID_LABELS.MISSING_DATA_PLACEHOLDER;
        }

        // Add mandatory columns
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
          if (val === 'Yes') {
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
            <CloudDoneIcon color="success" />
          ) : (
            <PendingIcon color="warning" />
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
 * Builds column definitions for the data grid based on UI specifications and
 * screen width.
 *
 * @param uiSpecification - UI specification
 * @param viewsetId - The viewset ID (if known/single entity type)
 * @param width - The current screen size category
 * @param includeKind - Whether to include record type in display
 * @param hasConflict - Whether any item has a conflict
 * @returns Array of column definitions for the DataGrid
 *
 * @description
 * Generates columns based on screen width:
 * - Small (xs/sm): Shows a vertical stack of fields with basic information
 * - Medium (md): Shows summary fields (or HRID) plus mandatory columns
 * - Large (lg): Shows all available columns including additional metadata
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
  let summaryFields: string[] = [];

  if (viewsetId) {
    summaryFields = getSummaryFieldInformation(
      uiSpecification,
      viewsetId
    ).fieldNames;
  }

  let columnList: GridColumnType[] = [];

  if (width === 'xs' || width === 'sm') {
    // Small width: vertical stack layout
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
    // Medium width: summary fields or HRID, plus mandatory columns
    columnList.push(
      buildColumnFromSystemField({
        columnType: 'SYNC_STATUS',
        uiSpecification,
      })
    );

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

    MANDATORY_COLUMNS.forEach(columnType => {
      columnList.push(
        buildColumnFromSystemField({
          columnType,
          uiSpecification,
        })
      );
    });

    if (hasConflict) {
      columnList.push(
        buildColumnFromSystemField({columnType: 'CONFLICTS', uiSpecification})
      );
    }
  } else if (width === 'lg') {
    // Large width: all columns
    if (includeKind) {
      columnList.push(
        buildColumnFromSystemField({
          columnType: 'KIND',
          uiSpecification,
        })
      );
    }

    columnList.push(
      buildColumnFromSystemField({
        columnType: 'SYNC_STATUS',
        uiSpecification,
      })
    );

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

    LARGE_COLUMNS.forEach(columnType => {
      columnList.push(
        buildColumnFromSystemField({
          columnType,
          uiSpecification,
        })
      );
    });

    if (hasConflict) {
      columnList.push(
        buildColumnFromSystemField({columnType: 'CONFLICTS', uiSpecification})
      );
    }
  }

  return columnList;
}

/**
 * A simple display for key-value pair data.
 * Used in vertical summary stack layout for small screens.
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
                  width: '30%',
                  borderBottom: 'none',
                  padding: '4px 8px',
                  textAlign: 'right',
                }}
              >
                {key}
              </TableCell>
              <TableCell
                sx={{
                  width: '70%',
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
// Sorting Utilities
// ============================================================================

/**
 * Sorts an array of records based on the specified sort option.
 * Works with UnhydratedRecord fields only (no hydration required).
 *
 * @param rows - The rows to sort
 * @param sortOption - The sort option to apply
 * @returns A new sorted array (does not mutate the original)
 */
function sortRows(
  rows: MinimalRecordMetadata[],
  sortOption: SortOption
): MinimalRecordMetadata[] {
  const config = SORT_OPTIONS[sortOption];
  const {field, direction} = config;

  return [...rows].sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];

    // Handle null/undefined values - push them to the end
    if (
      (aVal === null || aVal === undefined) &&
      (bVal === null || bVal === undefined)
    )
      return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    let comparison: number;

    // Date comparison
    if (aVal instanceof Date && bVal instanceof Date) {
      comparison = aVal.getTime() - bVal.getTime();
    }
    // Boolean comparison
    else if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
      comparison = aVal === bVal ? 0 : aVal ? -1 : 1;
    }
    // String/number comparison (using localeCompare for proper string sorting)
    else {
      comparison = String(aVal).localeCompare(String(bVal), undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    }

    return direction === 'asc' ? comparison : -comparison;
  });
}

// ============================================================================
// Custom Hooks
// ============================================================================

/**
 * Manages column definitions based on UI specifications and screen size.
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

    const includeKind = visibleTypes.length > 1;
    const viewsetId = visibleTypes.length === 1 ? visibleTypes[0] : '';

    return buildColumnDefinitions({
      uiSpecification: uiSpec,
      viewsetId,
      width: size,
      includeKind,
      hasConflict,
    });
  }, [uiSpec, visibleTypes, viewsets, size, hasConflict]);
};

/**
 * Manages row filtering based on visible types and adds sync status.
 * Also determines whether any row has conflicts.
 *
 * @param rows - Raw unhydrated records
 * @param visibleTypes - Types to filter by (empty = show all)
 * @param recordStatus - Sync status data if available
 * @returns Filtered rows and conflict flag
 */
const useFilteredRows = (
  rows: MinimalRecordMetadata[] | undefined,
  visibleTypes: string[]
) => {
  return useMemo(() => {
    let relevantRows: MinimalRecordMetadata[] = [];

    if (!rows) {
      relevantRows = [];
    } else if (visibleTypes.length === 0) {
      relevantRows = rows;
    } else {
      relevantRows = rows.filter(row => visibleTypes.includes(row.type));
    }

    return {
      rows: relevantRows,
      hasConflict: relevantRows.some(r => r.conflicts),
    };
  }, [rows, visibleTypes]);
};

/**
 * Manages sorting and pagination of rows.
 * Returns both the current page's rows (for hydration) and all sorted rows
 * (for the DataGrid).
 *
 * @param rows - Filtered rows to sort and paginate
 * @param sortOption - Current sort option
 * @param paginationModel - Current pagination state
 * @returns Sorted rows and current page slice
 */
const useSortedAndPaginatedRows = (
  rows: MinimalRecordMetadata[],
  sortOption: SortOption,
  paginationModel: {page: number; pageSize: number}
) => {
  return useMemo(() => {
    // Sort all rows
    const sorted = sortRows(rows, sortOption);

    // Calculate pagination slice
    const start = paginationModel.page * paginationModel.pageSize;
    const end = start + paginationModel.pageSize;
    const pageRows = sorted.slice(start, end);

    return {
      allSorted: sorted,
      pageRows,
    };
  }, [rows, sortOption, paginationModel]);
};

/**
 * Manages hydration of visible rows.
 * Creates React Query queries for each visible row and returns a map of
 * hydrated records.
 *
 * @param pageRows - Current page rows to hydrate
 * @param projectId - Project ID for fetching
 * @param uiSpec - UI specification
 * @param dataDb - Database instance
 * @param activeUser - Current user for auth context
 * @returns Object with hydration queries and a map of hydrated records
 */
const useRowHydration = (
  pageRows: MinimalRecordMetadata[],
  projectId: string,
  uiSpec: ProjectUIModel,
  dataDb: DataDbType,
  activeUser: ReturnType<typeof selectActiveUser>
) => {
  const token = activeUser?.parsedToken;

  const hydratedQueries = useQueries({
    queries: pageRows.map(row => ({
      queryKey: [
        activeUser?.username,
        token?.globalRoles,
        token?.resourceRoles,
        ...buildHydrateKeys({
          projectId,
          recordId: row.recordId,
          revisionId: '',
        }),
      ],
      queryFn: async () => {
        return await fetchAndHydrateRecord({
          dataDb,
          uiSpecification: uiSpec,
          projectId,
          recordId: row.recordId,
          revisionId: undefined,
        });
      },
      networkMode: 'always',
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    })),
  });

  // Build a map of hydrated records by ID
  const hydratedMap = useMemo(() => {
    const map = new Map<string, RecordMetadata>();
    pageRows.forEach((row, index) => {
      const query = hydratedQueries[index];
      if (query.data) {
        map.set(row.recordId, query.data);
      }
    });
    return map;
  }, [pageRows, hydratedQueries]);

  return {
    hydratedQueries,
    hydratedMap,
    isLoading: hydratedQueries.some(q => q.isLoading),
  };
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * MUI Data Grid based RecordsTable Component.
 *
 * Features:
 * - Lazy hydration: Only visible rows are hydrated, with results cached
 * - Custom sorting: Managed outside DataGrid for compatibility with lazy hydration
 * - Responsive columns: Different layouts for different screen sizes
 * - Sync status display: Shows whether records are synced to server
 * - Conflict indicators: Visual warning for records with conflicts
 *
 * @param props - Component props
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

  // Get UI specification
  const uiSpec = compiledSpecService.getSpec(uiSpecId);
  if (!uiSpec) {
    return <CircularLoading label="Loading" />;
  }

  // Get visible types from UI spec
  const visibleTypes = useMemo(() => {
    return getVisibleTypes(uiSpec);
  }, [uiSpec]);

  // Screen size for responsive columns
  const {currentSize, pageSize} = useScreenSize();

  // State: sorting and pagination
  const [sortOption, setSortOption] = useState<SortOption>(DEFAULT_SORT);
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: pageSize(maxRows) ?? 25,
  });

  // Filter rows by visible types and add sync status
  const {rows: rawFilteredRows, hasConflict} = useFilteredRows(
    rows,
    visibleTypes
  );

  // Add sync status information if available
  let filteredRows = rawFilteredRows;
  if (recordStatus) {
    filteredRows = rawFilteredRows.map(row => {
      const synced = recordStatus.status[row.recordId];
      return {
        ...row,
        synced,
      };
    });
  }

  // Sort and paginate
  const {allSorted, pageRows} = useSortedAndPaginatedRows(
    filteredRows,
    sortOption,
    paginationModel
  );

  // Build column definitions
  const columns = useTableColumns({
    uiSpec,
    visibleTypes,
    viewsets,
    size: currentSize,
    hasConflict,
  });

  // Get auth context for hydration
  const activeUser = useAppSelector(selectActiveUser);
  const dataDb = localGetDataDb(project_id);

  // Hydrate visible rows
  const {hydratedMap, isLoading: isHydrating} = useRowHydration(
    pageRows,
    project_id,
    uiSpec,
    dataDb,
    activeUser
  );

  // Merge hydrated data into sorted rows
  const displayRows = useMemo(() => {
    return allSorted.map(row => ({
      ...(hydratedMap.get(row.recordId) ?? row),
      synced: recordStatus ? recordStatus.status[row.recordId] : undefined,
    }));
  }, [allSorted, hydratedMap]);

  // Handle sort change - reset to first page when sort changes
  const handleSortChange = useCallback((newSort: SortOption) => {
    setSortOption(newSort);
    setPaginationModel(prev => ({...prev, page: 0}));
  }, []);

  // Handle row click - navigate to record view
  const handleRowClick = useCallback<GridEventListener<'rowClick'>>(
    params => {
      // TODO note this is untidy - it's because we have lost typing here on the
      // params.row - it can be either a record_id or recordId as the hydrated
      // type RecordMetadata uses record_id, and the unhydrated type
      // UnhydratedRecord uses recordId
      let route = undefined;
      if (params.row.recordId) {
        route = ROUTES.getViewRecordRoute({
          serverId,
          projectId: project_id,
          recordId: params.row.recordId,
        });
      } else if (params.row.record_id) {
        route = ROUTES.getViewRecordRoute({
          serverId,
          projectId: project_id,
          recordId: params.row.record_id,
        });
      } else {
        // do nothing in this case - there is an issue
        return;
      }
      history(route);
    },
    [history, project_id, serverId]
  );

  return (
    <Box component={Paper} elevation={3} sx={styles.wrapper}>
      <DataGrid
        rows={displayRows}
        loading={loading || isHydrating}
        getRowId={r => {
          return 'recordId' in r ? r.recordId : r.record_id;
        }}
        columns={columns}
        // Pagination - controlled
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        pageSizeOptions={[10, 15, 20, 25, 50, 100]}
        // Disable all DataGrid sorting/filtering - we manage it ourselves
        disableColumnFilter
        disableColumnMenu
        disableColumnSelector
        // Row configuration
        autoHeight
        getRowHeight={() => 'auto'}
        disableRowSelectionOnClick
        onRowClick={handleRowClick}
        getRowClassName={params => (params.row.conflicts ? 'conflict-row' : '')}
        // Custom toolbar with sort control
        slots={{toolbar: NotebookDataGridToolbar}}
        slotProps={{
          filterPanel: {sx: {maxWidth: '96vw'}},
          toolbar: {
            handleQueryFunction: props.handleQueryFunction,
            // Pass sort control as additional toolbar content
            additionalControls: (
              <SortControl value={sortOption} onChange={handleSortChange} />
            ),
          },
        }}
        sx={styles.grid}
      />
    </Box>
  );
}
