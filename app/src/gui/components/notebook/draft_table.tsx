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
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {Box, Paper, Typography} from '@mui/material';
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
import {compiledSpecService} from '../../../context/slices/helpers/compiledSpecService';
import {
  getSummaryFieldInformation,
  getVisibleTypes,
} from '../../../uiSpecification';
import {prettifyFieldName} from '../../../utils/formUtilities';
import getLocalDate from '../../fields/LocalDate';
import {NotebookDraftDataGridToolbar} from './datagrid_toolbar';
import RecordDelete from './delete';

type DraftsRecordProps = {
  project_id: ProjectID;
  serverId: string;
  maxRows: number | null;
  rows: any;
  loading: boolean;
  viewsets?: ProjectUIViewsets | null;
  handleRefresh: () => void;
};

function getDisplayDataFromDraft(
  field: string,
  data: {[key: string]: any}
): string | undefined {
  const value = data[field];
  console.log('value in drafts', value);

  if (value === undefined || value === null) return undefined;
  if (typeof value === 'object') return JSON.stringify(value);
  return value.toString();
}

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

  const defaultMaxRowsMobile = 10;

  const uiSpecId = rows?.[0]?.ui_spec_id || project_id;
  const uiSpec = compiledSpecService.getSpec(uiSpecId);
  const visibleTypes = useMemo(
    () => (uiSpec ? getVisibleTypes(uiSpec) : []),
    [uiSpec]
  );

  // The entire row is clickable to the record
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

  const summaryFields = useMemo(() => {
    if (!uiSpec || visibleTypes.length !== 1) return [];
    return getSummaryFieldInformation(uiSpec, visibleTypes[0]).fieldNames;
  }, [uiSpec, visibleTypes]);

  const getKindLabel = (type: string) =>
    viewsets && type && viewsets[type]?.label ? viewsets[type].label : type;

  const columns: GridColDef[] = [
    ...(summaryFields.length > 0
      ? summaryFields.map(field => ({
          field,
          headerName: prettifyFieldName(field),
          type: 'string',
          flex: 1,
          renderCell: (params: GridCellParams) => (
            <Typography>
              {getDisplayDataFromDraft(field, params.row.data || {}) || '-'}
            </Typography>
          ),
        }))
      : [
          {
            field: 'hrid',
            headerName: 'HRID/UUID',
            type: 'string',
            flex: 1,
            renderCell: (params: GridCellParams) => (
              <Typography fontWeight="bold">{params.row.hrid}</Typography>
            ),
          },
        ]),

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
      field: 'updated',
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
      field: 'created_by',
      headerName: 'Created By',
      type: 'string',
      flex: 1,
      renderCell: (params: GridCellParams) => (
        <Typography>{params.row.created_by || '-'}</Typography>
      ),
    },
    {
      field: 'updated_by',
      headerName: 'Last Updated By',
      type: 'string',
      flex: 1,
      renderCell: (params: GridCellParams) => (
        <Typography>{params.row.updated_by || '-'}</Typography>
      ),
    },
    {
      field: 'type',
      headerName: 'Type',
      flex: 1,
      renderCell: (params: GridCellParams) => (
        <Typography>{getKindLabel(params.row.type)}</Typography>
      ),
    },
    {
      field: 'conflicts',
      headerName: 'Conflicts',
      flex: 0.5,
      renderCell: (params: GridCellParams) =>
        params.row.conflicts ? (
          <WarningAmberIcon color="warning" sx={{marginRight: 1}} />
        ) : (
          '-'
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
    },
  ];
  return (
    <React.Fragment>
      <Box component={Paper} elevation={0}>
        <DataGrid
          key={'drafttable'}
          rows={rows}
          loading={loading}
          getRowId={r => r._id}
          columns={columns}
          autoHeight
          sx={{
            cursor: 'pointer',
            padding: '8px',
            backgroundColor: theme.palette.background.tabsBackground,
            borderRadius: '4px',
            boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.2)',
            mb: 2,
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: theme.palette.background.default,
              borderBottom: '1px solid #ccc',
            },
            '& .MuiDataGrid-columnSeparator': {
              visibility: 'visible',
              color: '#ccc',
            },
            '& .MuiDataGrid-cell': {
              borderBottom: '1px solid #eee',
            },
          }}
          getRowHeight={() => 'auto'}
          disableRowSelectionOnClick
          onRowClick={handleRowClick}
          components={{
            Toolbar: NotebookDraftDataGridToolbar,
          }}
          componentsProps={{
            filterPanel: {sx: {maxWidth: '96vw'}},
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
