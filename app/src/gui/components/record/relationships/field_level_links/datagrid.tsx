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

import {RecordID, RecordMetadata, RecordReference} from '@faims3/data-model';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  CircularProgress,
  Modal,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  DataGrid,
  GridActionsCellItem,
  GridCellParams,
  GridRow,
  GridRowParams,
} from '@mui/x-data-grid';
import React, {useEffect, useState} from 'react';
import {getRecordRoute} from '../../../../../constants/routes';
import {selectProjectById} from '../../../../../context/slices/projectSlice';
import {useAppSelector} from '../../../../../context/store';
import {
  getFieldLabel,
  getSummaryFieldInformation,
} from '../../../../../uiSpecification';
import RecordRouteDisplay from '../../../ui/record_link';
import {gridParamsDataType} from '../record_links';
import {RecordLinksToolbar} from '../toolbars';
import {compiledSpecService} from '../../../../../context/slices/helpers/compiledSpecService';

const style = {
  position: 'absolute' as const,
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  p: 1,
};

// Unused component - referenced in RelatedRecordSelector and commented out
// because it is unreachable (I think - SC)
export function DataGridNoLink(props: {
  links: RecordReference[];
  relation_linked_vocab: string;
  relation_type: string;
}) {
  const columns: any = [
    {
      field: 'relation_type_vocabPair',
      headerName: 'Relationship',
      headerClassName: 'faims-record-link--header',
      minWidth: 200,
      flex: 0.2,
      valueGetter: (params: gridParamsDataType) =>
        params.value !== undefined
          ? params.value[0]
          : props.relation_linked_vocab,
    },
    {
      field: 'record_label',
      headerName: 'Record',
      headerClassName: 'faims-record-link--header',
      minWidth: 200,
      flex: 0.4,
      valueGetter: (params: GridCellParams) =>
        params.row.record_label ?? params.row.record_id,
      renderCell: (params: GridCellParams) => (
        <>
          {params.value}
          <CircularProgress size={12} thickness={5} />
        </>
      ),
    },
    {
      field: 'record_id',
      headerName: 'Updated',
      headerClassName: 'faims-record-link--header',
      minWidth: 100,
      valueGetter: () => '',
      flex: 0.4,
    },
  ];
  // remove any invalid entries in links (due to a bug elsewhere)
  const links = props.links.filter(link => link.record_id);
  return props.links !== null && props.links.length > 0 ? (
    <DataGrid
      autoHeight
      density={'compact'}
      rowCount={5}
      pageSizeOptions={[5, 10, 20]} // 100 here to disable an error thrown by MUI
      disableRowSelectionOnClick
      slotProps={{
        filterPanel: {sx: {maxWidth: '96vw'}},
      }}
      columns={columns}
      initialState={{
        sorting: {
          sortModel: [{field: 'lastUpdatedBy', sort: 'desc'}],
        },
        pagination: {paginationModel: {pageSize: 5}},
      }}
      rows={links}
      getRowId={r => r.record_id}
    />
  ) : (
    <Box></Box>
  );
}

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

    const route = getRecordRoute(
      props.serverId,
      props.child_record.project_id,
      props.child_record.record_id,
      props.child_record.revision_id
    );

    if (props.child_record.record_id === props.current_record_id) {
      return <RecordRouteDisplay>This record</RecordRouteDisplay>;
    } else {
      return (
        <Stack>
          <Typography variant={'body2'} fontWeight={'bold'}>
            <RecordRouteDisplay
              link={props.child_record.deleted ? '' : route}
              deleted={props.child_record.deleted}
            >
              {props.child_record.type + ': ' + props.child_record.hrid}
            </RecordRouteDisplay>
          </Typography>
          {displayFields.map(fieldName => {
            if (props.child_record.data) {
              const value = props.child_record.data[fieldName];
              if (typeof value === 'string')
                return (
                  <Typography key={fieldName} variant={'body2'}>
                    {uiSpec ? getFieldLabel(uiSpec, fieldName) : fieldName}:{' '}
                    {props.child_record.data
                      ? props.child_record.data[fieldName]
                      : ''}
                  </Typography>
                );
            }
            return <></>;
          })}
        </Stack>
      );
    }
  }

  const relation_column = {
    field: 'relation_type_vocabPair',
    headerName: 'Relationship',
    headerClassName: 'faims-record-link--header',
    minWidth: 200,
    flex: 0.2,
    valueGetter: (params: gridParamsDataType) => {
      const rel = params.row.relationship;
      if (rel.linked && rel.linked.length > 0) {
        // find the link that is back to us
        const links_to_us = rel.linked.filter(
          (link: any) => link.record_id === params.id
        );
        if (links_to_us && links_to_us.length > 0) {
          const rvp = links_to_us[0].relation_type_vocabPair;
          return (rvp && rvp.length > 0 && rvp[1]) || 'linked';
        } else if (links_to_us.parent) return 'parent';
        else return 'linked';
      }
    },
  };

  const record_column = {
    field: 'record',
    headerName: 'Record',
    headerClassName: 'faims-record-link--header',
    minWidth: 200,
    flex: 0.4,
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

  const updated_by_column = {
    field: 'lastUpdatedBy',
    headerName: 'Updated',
    headerClassName: 'faims-record-link--header',
    minWidth: 150,
    flex: 0.2,
    valueGetter: (params: GridCellParams) => params.row.updated_by,
  };

  const columns: any =
    props.relation_type === 'Child'
      ? [record_column, updated_by_column]
      : [relation_column, record_column, updated_by_column];

  if (!props.disabled)
    columns.push({
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      headerClassName: 'faims-record-link--header',
      flex: 0.2,
      getActions: (params: GridRowParams) => [
        <GridActionsCellItem
          icon={<LinkOffIcon color={'error'} />}
          onClick={handleModalOpen(params.row)}
          label="Remove link"
          showInMenu
        />,
      ],
    });

  return (
    <Box component={Paper} elevation={0}>
      {props.links !== null && (
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
            slots={{
              footer: RecordLinksToolbar,
            }}
            slotProps={{
              filterPanel: {sx: {maxWidth: '96vw'}},
            }}
            columns={columns}
            initialState={{
              sorting: {
                sortModel: [{field: 'lastUpdatedBy', sort: 'desc'}],
              },
              pagination: {paginationModel: {pageSize: 5}},
            }}
            rows={props.links}
            getRowId={getRowId}
          />
        </Box>
      )}
    </Box>
  );
}
