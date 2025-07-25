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
 * Filename: relationships/link_datagrid.tsx
 * Description:
 *   TODO
 */

import {RecordID, RecordMetadata} from '@faims3/data-model';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Modal,
  Paper,
  Typography,
  useTheme
} from '@mui/material';
import {
  DataGrid,
  GridActionsCellItem,
  GridCellParams,
  GridColDef,
  GridEventListener,
  GridRow,
  GridRowParams,
} from '@mui/x-data-grid';
import React, {useCallback, useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {getExistingRecordRoute} from '../../../../../constants/routes';
import {compiledSpecService} from '../../../../../context/slices/helpers/compiledSpecService';
import {selectProjectById} from '../../../../../context/slices/projectSlice';
import {useAppSelector} from '../../../../../context/store';
import {
  getFieldLabel,
  getSummaryFieldInformation,
} from '../../../../../uiSpecification';
import {useDataGridStyles} from '../../../../../utils/useDataGridStyles';
import {useScreenSize} from '../../../../../utils/useScreenSize';
import {
  buildColumnFromSystemField,
  buildVerticalStackColumn,
  KeyValueTable,
  RECORD_GRID_LABELS,
} from '../../../notebook/record_table';
import RecordRouteDisplay from '../../../ui/record_link';
import {gridParamsDataType} from '../record_links';
import {RecordLinksToolbar} from '../toolbars';

type ColumnType = 'CREATED' | 'CREATED_BY' | 'LAST_UPDATED' | 'LAST_UPDATED_BY';

const style = {
  position: 'absolute' as const,
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  p: 1,
};

interface DataGridLinksComponentProps {
  project_id: string;
  serverId: string;
  links: Array<RecordMetadata> | null;
  record_id: RecordID;
  record_hrid: string;
  record_type: string;
  field_name: string;
  handleUnlink?: Function;
  handleReset?: Function;
  disabled?: boolean;
  relation_type?: string;
}

export function DataGridFieldLinksComponent(
  props: DataGridLinksComponentProps
) {
  const {currentSize} = useScreenSize();
  /**
   * Display the linked records in a MUI Datagrid.
   * Datagrid is set to autoHeight (grid will size according to its content) up to 5 rows
   * Optionally display title, link_type, records' section and field that the link belongs to.
   * Links can be unlinked via a modal interface accessible through an action menu
   */
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalLink, setModalLink] = React.useState(
    null as null | GridRowParams['row']
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const uiSpecId = useAppSelector(state =>
    selectProjectById(state, props.project_id)
  )?.uiSpecificationId;
  const uiSpec = uiSpecId ? compiledSpecService.getSpec(uiSpecId) : undefined;
  const history = useNavigate();
  const theme = useTheme();
  const styles = useDataGridStyles(theme); // Add this

  function getRowId(row: any) {
    /***
     * Provide a unique row id for each row
     */
    return row.record_id;
  }
  const handleModalClose = () => {
    // Close the modal, remove the focused link
    setModalOpen(false);
    setModalLink(null);
  };

  const handleModalOpen = React.useCallback(
    (row: typeof GridRow) => () => {
      setModalOpen(true);
      setModalLink(row);
    },
    []
  );

  function handleUnlink() {
    setIsSubmitting(true);

    if (props.handleUnlink !== undefined)
      props.handleUnlink(modalLink.record_id, modalLink.hrid).then(() => {
        const timer = setTimeout(() => {
          // reset local state of component
          setIsSubmitting(false);
          setModalOpen(false);
        }, 500);
        return () => {
          clearTimeout(timer);
        };
      });
  }

  const handleRowClick = useCallback<GridEventListener<'rowClick'>>(
    params => {
      history(
        getExistingRecordRoute({
          serverId: props.serverId,
          projectId: props.project_id,
          recordId: (params.row.record_id || '').toString(),
          revisionId: (params.row.revision_id || '').toString(),
        })
      );
    },
    [history, props.serverId, props.project_id]
  );

  function ChildRecordDisplay(props: {
    current_record_id: RecordID;
    child_record: RecordMetadata;
    serverId: string;
  }) {
    const [displayFields, setDisplayFields] = useState<Array<string>>([]);
    useEffect(() => {
      const fn = async () => {
        if (uiSpec)
          setDisplayFields(
            getSummaryFieldInformation(uiSpec, props.child_record.type)
              .fieldNames
          );
      };
      fn();
    }, [props.child_record]);

    if (props.child_record.record_id === props.current_record_id) {
      return <RecordRouteDisplay>This record</RecordRouteDisplay>;
    } else {
      const data: {[key: string]: string} = {
        ID: props.child_record.hrid,
      };
      displayFields.forEach(fieldName => {
        if (props.child_record.data) {
          const value = props.child_record.data[fieldName];
          if (typeof value === 'string') {
            const label = uiSpec ? getFieldLabel(uiSpec, fieldName) : fieldName;
            data[label] = value;
          }
        }
      });

      return <KeyValueTable data={data} />;
    }
  }

  const relation_column = {
    field: 'relation_type_vocabPair',
    headerName: 'Relationship',
    minWidth: 150,
    flex: 0.2,
    valueGetter: (params: gridParamsDataType) => {
      const rel = params.row.relationship;
      if (rel.linked && rel.linked.length > 0) {
        // if the relationship has a linked record, return the type
        // find the link that is back to us
        const links_to_us = rel.linked.filter(
          (link: any) => link.record_id === props.record_id
        );
        if (links_to_us && links_to_us.length > 0) {
          const rvp = links_to_us[0].relation_type_vocabPair;
          return (rvp && rvp.length > 0 && rvp[1]) || 'linked';
        } else if (links_to_us.parent) return 'parent';
        else return 'linked';
      }
    },
  };

  const record_column: GridColDef = {
    field: 'record',
    headerName: 'Details',
    minWidth: 200,
    flex: 2,
    valueGetter: (params: GridCellParams) =>
      params.row.type + ' ' + params.row.hrid,
    renderCell: (params: GridCellParams) => (
      <ChildRecordDisplay
        current_record_id={props.record_id}
        serverId={props.serverId}
        child_record={params.row}
      />
    ),
  };

  const smallScreenColumn: GridColDef | null =
    uiSpec && currentSize === 'xs'
      ? buildVerticalStackColumn({
          summaryFields: [],
          columnLabel: RECORD_GRID_LABELS.VERTICAL_STACK_COLUMN_LABEL,
          uiSpecification: uiSpec,
          includeKind: false,
          hasConflict: false,
        })
      : null;

  /** Columns that must always be shown */
  const SYSTEM_COLUMNS: ColumnType[] = ['CREATED', 'CREATED_BY'];

  /** Columns to show in large view */
  if (currentSize === 'lg') {
    SYSTEM_COLUMNS.push('LAST_UPDATED');
    SYSTEM_COLUMNS.push('LAST_UPDATED_BY');
  }

  // System fields for medium+ screens
  const systemColumns: GridColDef[] = uiSpec
    ? SYSTEM_COLUMNS.map(c =>
        buildColumnFromSystemField({columnType: c, uiSpecification: uiSpec!})
      )
    : [];

  const columns: GridColDef[] = [];

  if (smallScreenColumn) {
    // S/SM: relationship into the Details stack
    columns.push({
      ...smallScreenColumn,
      renderCell: params => (
        <Box>
          {/*  relationship above the stacked details */}
          {props.relation_type !== 'Child' && (
            <Typography variant="body2" sx={{mb: 1}}>
              Relationship:{' '}
              <strong>{relation_column.valueGetter!(params as any)}</strong>
            </Typography>
          )}
          {/* vertical-stack cell under  */}
          {smallScreenColumn.renderCell!(params)}
        </Box>
      ),
    });
  } else {
    // MD/LG:  relationship in its own column, tghen record + system columns
    if (props.relation_type !== 'Child') {
      columns.push(relation_column);
    }
    columns.push(record_column, ...systemColumns);
  }

  //  “remove link” actions menu
  if (!props.disabled) {
    columns.push({
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      flex: 0.15,
      minWidth: 90,
      getActions: (params: GridRowParams) => [
        <GridActionsCellItem
          icon={<LinkOffIcon color="error" />}
          onClick={handleModalOpen(params.row)}
          label="Remove link"
          showInMenu
        />,
      ],
    });
  }

  return (
    <Box
      component={Paper}
      elevation={0}
      sx={{...styles.wrapper, overflowX: 'auto', overflowY: 'hidden'}}
    >
      {props.links && (
        <Box>
          <Modal
            open={modalOpen}
            onClose={handleModalClose}
            aria-labelledby="modal-modal-title"
            aria-describedby="modal-modal-description"
          >
            <Box component={Paper} sx={style}>
              {modalLink === null ? (
                'No link selected'
              ) : (
                <React.Fragment>
                  <Alert
                    severity={'warning'}
                    sx={{mb: 1}}
                    icon={<LinkOffIcon />}
                  >
                    <Box
                      sx={{
                        overflowX: 'scroll',
                        width: '100%',
                        mb: 2,
                        whitespace: 'nowrap',
                      }}
                    >
                      Do you wish to remove the link <br />
                      <br />
                      <strong>Field: {props.field_name} </strong>
                      {props.relation_type}
                      <RecordRouteDisplay>
                        {modalLink.type} {modalLink.hrid}
                      </RecordRouteDisplay>
                    </Box>
                  </Alert>
                  <ButtonGroup fullWidth disableElevation>
                    <Button onClick={handleUnlink} variant={'contained'}>
                      {isSubmitting ? 'Working...' : 'Unlink'}
                    </Button>
                    <Button onClick={handleModalClose} variant={'outlined'}>
                      cancel
                    </Button>
                  </ButtonGroup>
                </React.Fragment>
              )}
            </Box>
          </Modal>
          <DataGrid
            autoHeight
            getRowHeight={() => 'auto'}
            density={'compact'}
            pageSizeOptions={[5, 10, 20]}
            disableRowSelectionOnClick
            onRowClick={handleRowClick}
            slots={{
              footer: RecordLinksToolbar,
            }}
            columns={columns}
            disableColumnFilter
            initialState={{
              sorting: {
                sortModel: [{field: 'last_updated', sort: 'desc'}],
              },
              pagination: {paginationModel: {pageSize: 5}},
            }}
            rows={props.links}
            getRowId={getRowId}
            sx={{
              ...styles.grid,
              '& .MuiDataGrid-columnHeaders': {
                width: '100%',
                minHeight: '70px !important',
              },
              /* Hide horizontal scroll & arrows on md / lg screens */
              [theme.breakpoints.up('md')]: {
                '& .MuiDataGrid-virtualScroller': {
                  overflowX: 'hidden !important',
                },
                '& .MuiDataGrid-scrollArea': {display: 'none'},
              },
            }}
          />
        </Box>
      )}
    </Box>
  );
}
