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
 * Filename: draft_table.tsx
 * Description: This document is to get all draft record
 *   TODO need to check created draft route
 */

import {DraftMetadata, ProjectID, ProjectUIViewsets} from '@faims3/data-model';
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
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  DataGrid,
  GridCellParams,
  GridColDef,
  GridEventListener,
} from '@mui/x-data-grid';
import React, {useMemo} from 'react';
import {useNavigate} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';
import {NotebookDraftDataGridToolbar} from './datagrid_toolbar';
import RecordDelete from './delete';
import {compiledSpecService} from '../../../context/slices/helpers/compiledSpecService';
import {
  getSummaryFieldInformation,
  getVisibleTypes,
} from '../../../uiSpecification';
import {prettifyFieldName} from '../../../utils/formUtilities';
import getLocalDate from '../../fields/LocalDate';
import {useDataGridStyles} from '../../../utils/useDataGridStyles';
import {useScreenSize} from '../../../utils/useScreenSize';

/**
 * Props for the `DraftsTable` component
 */
type DraftsRecordProps = {
  project_id: ProjectID;
  serverId: string;
  maxRows: number | null;
  rows: any;
  loading: boolean;
  viewsets?: ProjectUIViewsets | null;
  handleRefresh: () => void;
};

/**
 * Returns the value from a draft row for a given field.
 * Looks both at top-level keys and inside the `data` field.
 *
 * @param field - The field name to extract
 * @param row - The draft row
 * @returns The stringified value, or '-' if not found
 */
function getDisplayDataFromDraft(field: string, row: any): string | undefined {
  const value = row?.[field] ?? row?.data?.[field];
  if (value === undefined || value === null) return '-';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/**
 * React component for rendering the drafts table view.
 *
 * @component
 * @param props - Component props
 * @param props.project_id - The project ID
 * @param props.serverId - Server identifier for route navigation
 * @param props.maxRows - Maximum rows to show in the table (pagination limit)
 * @param props.rows - Array of draft records to display
 * @param props.loading - Flag indicating if data is loading
 * @param props.viewsets - Optional viewsets for mapping types to labels
 * @param props.handleRefresh - Callback to trigger data refresh
 * @returns A responsive DataGrid component for drafts (mobile & desktop views)
 */
export function DraftsTable(props: DraftsRecordProps) {
  const {
    project_id,
    serverId,
    maxRows,
    rows,
    loading,
    viewsets,
    handleRefresh,
  } = props;
  const theme = useTheme();
  const history = useNavigate();
  const not_xs = useMediaQuery(theme.breakpoints.up('sm'));
  const styles = useDataGridStyles(theme);
  const {currentSize, pageSize} = useScreenSize();

  const defaultMaxRowsMobile = 10;

  const uiSpecId = rows?.[0]?.ui_spec_id || project_id;
  const uiSpec = compiledSpecService.getSpec(uiSpecId);

  const visibleTypes = useMemo(
    () => (uiSpec ? getVisibleTypes(uiSpec) : []),
    [uiSpec]
  );

  const includeKind = visibleTypes.length > 1;
  const summaryFields = useMemo(() => {
    if (!uiSpec || visibleTypes.length !== 1) return ['hrid'];
    return getSummaryFieldInformation(uiSpec, visibleTypes[0]).fieldNames;
  }, [uiSpec, visibleTypes]);

  /**
   * Navigates to the draft editing route when a row is clicked.
   *
   * @param params - Row click event params containing draft data
   */
  const handleRowClick: GridEventListener<'rowClick'> = params => {
    history(
      ROUTES.getDraftRoute(
        serverId,
        project_id ?? 'dummy',
        params.row._id as DraftMetadata['_id'],
        params.row.existing! as DraftMetadata['existing'],
        params.row.type! as DraftMetadata['type'],
        params.row.record_id as DraftMetadata['record_id']
      )
    );
  };

  /**
   * Defines the columns used in the DataGrid based on screen size.
   * Mobile view shows a compact vertical stack, desktop uses multiple columns.
   */
  const columns: GridColDef[] = useMemo(() => {
    const isMobile = currentSize === 'xs' || currentSize === 'sm';
    if (isMobile) {
      return [
        {
          field: 'summary',
          headerName: 'Details',
          type: 'string',
          flex: 1,
          renderCell: (params: GridCellParams) => {
            //  key-value pairs to show in a stacked table layout (mobile view)
            const row = params.row || {};
            const data = row.data || {};

            const kvp: {[key: string]: string} = {};

            // includiing record type label
            if (includeKind) {
              kvp['Type'] = viewsets?.[row.type]?.label ?? row.type ?? '-';
            }

            // summary fields or hrid
            (summaryFields.length > 0 ? summaryFields : ['hrid']).forEach(
              field => {
                let value = row?.[field];
                if (value === undefined) {
                  value = getDisplayDataFromDraft(field, data);
                }
                const label =
                  field === 'hrid' ? 'Field ID' : prettifyFieldName(field);
                kvp[label] = value || '-';
              }
            );

            kvp['Created'] = row.created
              ? getLocalDate(row.created).replace('T', ' ')
              : '-';

            kvp['Last Updated'] = row.updated
              ? getLocalDate(row.updated).replace('T', ' ')
              : '-';

            return (
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    {Object.entries(kvp).map(([key, val]) => (
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
          },
        },
      ];
    }

    const baseCols: GridColDef[] = [];

    (summaryFields.length > 0 ? summaryFields : ['hrid']).forEach(field => {
      baseCols.push({
        field,
        headerName: field === 'hrid' ? 'Field ID' : prettifyFieldName(field),
        type: 'string',
        flex: 1,
        renderCell: (params: GridCellParams) => (
          <Typography>
            {getDisplayDataFromDraft(field, params.row) || '-'}
          </Typography>
        ),
      });
    });
    baseCols.push(
      {
        field: 'created',
        headerName: 'Created',
        type: 'dateTime',
        flex: 1,
        renderCell: (params: GridCellParams) => (
          <Typography>
            {params.row.created
              ? getLocalDate(params.row.created).replace('T', ' ')
              : '-'}
          </Typography>
        ),
      },

      {
        field: 'last_updated',
        headerName: 'Last Updated',
        type: 'dateTime',
        flex: 1,
        renderCell: (params: GridCellParams) => (
          <Typography>
            {params.row.updated
              ? getLocalDate(params.row.updated).replace('T', ' ')
              : '-'}
          </Typography>
        ),
      },

      {
        field: 'delete',
        headerName: 'Actions',
        type: 'actions',
        flex: 0.3,
        renderCell: (params: GridCellParams) => (
          <RecordDelete
            project_id={project_id}
            serverId={serverId}
            record_id={params.row.record_id}
            revision_id={params.row.revision_id}
            draft_id={params.row._id}
            show_label={false}
            handleRefresh={handleRefresh}
          />
        ),
      }
    );

    return baseCols;
  }, [summaryFields, viewsets, currentSize]);

  return (
    <React.Fragment>
      <Box
        component={Paper}
        elevation={0}
        sx={{backgroundColor: 'voilet', padding: 2}}
      >
        <DataGrid
          key={'drafttable'}
          rows={rows}
          loading={loading}
          getRowId={r => r._id}
          columns={columns}
          autoHeight
          sx={styles.grid}
          getRowHeight={() => 'auto'}
          disableRowSelectionOnClick
          onRowClick={handleRowClick}
          components={{
            Toolbar: NotebookDraftDataGridToolbar,
          }}
          componentsProps={{
            filterPanel: {sx: {maxWidth: '96vw'}},
          }}
          sortModel={[{field: 'last_updated', sort: 'desc'}]}
          initialState={{
            sorting: {
              sortModel: [{field: 'last_updated', sort: 'desc'}],
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
