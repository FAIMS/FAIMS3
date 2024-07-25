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

import React from 'react';
import {
  Alert,
  Box,
  ButtonGroup,
  Button,
  Typography,
  Modal,
  Paper,
  CircularProgress,
} from '@mui/material';
import {
  DataGrid,
  GridActionsCellItem,
  GridCellParams,
  GridRow,
  GridRowParams,
} from '@mui/x-data-grid';
import {DataGridLinksComponentProps} from '../types';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import {RecordLinksToolbar} from '../toolbars';
import {RecordID} from 'faims3-datamodel';
import RecordRouteDisplay from '../../../ui/record_link';
import {RecordReference} from 'faims3-datamodel';
import Checkbox from '@mui/material/Checkbox';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {gridParamsDataType} from '../record_links';

const style = {
  position: 'absolute' as const,
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  p: 1,
};

export function DataGridNoLink(props: {
  links: RecordReference[];
  relation_linked_vocab: string;
  relation_type: string;
  relation_preferred_label: string;
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
      headerName: 'Last Updated By',
      headerClassName: 'faims-record-link--header',
      minWidth: 100,
      valueGetter: () => '',
      flex: 0.4,
    },
  ];
  if (props.relation_type === 'Child' && props.relation_preferred_label !== '')
    columns.push({
      field: 'preferred',
      headerName: props.relation_preferred_label,
      headerClassName: 'faims-record-link--header',
      minWidth: 200,
      flex: 0.2,
      valueGetter: (params: GridCellParams) => params.row.is_preferred ?? false,
      renderCell: (params: GridCellParams) =>
        params.value ? <>{props.relation_preferred_label}</> : <></>,
    });
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

export default function DataGridFieldLinksComponent(
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
  function getRowId(row: any) {
    /***
     * Provide a unique row id for each row
     */
    return (
      row.record_id +
      row.relation_type_vocabPair[0] +
      row.link.record_id +
      row.link.field_id
    );
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
  function recordDisplay(
    current_record_id: RecordID,
    record_id: RecordID,
    type: string,
    hrid: string,
    route: any,
    deleted: boolean
  ) {
    return record_id === current_record_id ? (
      <RecordRouteDisplay>This record</RecordRouteDisplay>
    ) : (
      <Typography variant={'body2'} fontWeight={'bold'}>
        <RecordRouteDisplay link={deleted ? '' : route} deleted={deleted}>
          {type + ' ' + hrid}
        </RecordRouteDisplay>
      </Typography>
    );
  }
  const columns: any = [
    {
      field: 'relation_type_vocabPair',
      headerName: 'Relationship',
      headerClassName: 'faims-record-link--header',
      minWidth: 200,
      flex: 0.2,
      valueGetter: (params: gridParamsDataType) => params.value[1],
    },
    {
      field: 'record',
      headerName: 'Record',
      headerClassName: 'faims-record-link--header',
      minWidth: 200,
      flex: 0.4,
      valueGetter: (params: GridCellParams) =>
        params.row.type + ' ' + params.row.hrid,
      renderCell: (params: GridCellParams) =>
        recordDisplay(
          props.record_id,
          params.row.record_id,
          params.row.type,
          params.row.hrid,
          params.row.route,
          params.row.deleted
        ),
    },

    {
      field: 'lastUpdatedBy',
      headerName: 'Last Updated By',
      headerClassName: 'faims-record-link--header',
      minWidth: 150,
      flex: 0.2,
      valueGetter: (params: GridCellParams) => params.row.lastUpdatedBy,
    },
  ];
  // for read ONLY

  // BBS 20221117 checking on empty label to toggle. Label is set in src/gui/fields/RelatedRecordSelector.tsx
  if (
    props.relation_type === 'Child' &&
    props.disabled !== true &&
    props.relation_preferred_label !== ''
  )
    columns.push({
      field: 'preferred',
      headerName: 'Make ' + props.relation_preferred_label,
      headerClassName: 'faims-record-link--header',
      minWidth: 100,
      flex: 0.2,
      align: 'center',
      headerAlign: 'center',
      valueGetter: (params: GridCellParams) =>
        params.row.relation_preferred ?? false,
      renderCell: (params: GridCellParams) => (
        <Checkbox
          checked={params.row.value}
          disabled={
            props.preferred !== undefined &&
            props.preferred !== null &&
            props.preferred !== params.row.record_id
              ? true
              : false
          }
          onChange={(event: any) => {
            if (props.handleMakePreferred !== undefined)
              props.handleMakePreferred(
                params.row.record_id,
                event.target.checked
              );
          }}
        />
      ),
    });
  else if (
    props.relation_type === 'Child' &&
    props.disabled === true &&
    props.relation_preferred_label !== ''
  )
    columns.push({
      field: 'preferred',
      headerName: 'Make ' + props.relation_preferred_label,
      headerClassName: 'faims-record-link--header',
      minWidth: 200,
      flex: 0.2,
      valueGetter: (params: GridCellParams) =>
        params.row.relation_preferred ?? false,
      renderCell: (params: GridCellParams) =>
        params.value ? (
          <>
            <CheckCircleIcon color="success" /> {props.relation_preferred_label}
          </>
        ) : (
          <></>
        ),
    });
  if (props.disabled !== true)
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
                      <strong>Field: {modalLink.link.field_label} </strong>
                      {modalLink.relation_type_vocabPair[1]}{' '}
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
