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
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  DataGrid,
  GridActionsCellItem,
  GridCellParams,
  GridColumns,
  GridRow,
  GridRowParams,
} from '@mui/x-data-grid';
import {DataGridLinksComponentProps, PARENT_CHILD_VOCAB} from '../types';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import {RecordLinksToolbar} from '../toolbars';
import {RecordID} from '../../../../../datamodel/core';
import RecordRouteDisplay from '../../../ui/record_link';
import {RecordReference} from '../../../../../datamodel/ui';
import { GRID_CHECKBOX_SELECTION_COL_DEF } from '@mui/x-data-grid';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
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
  relation_type:string;
}) {
  const columns: GridColumns = [
    {
      field: 'record_label',
      headerName: 'Record',
      minWidth: 200,
      flex: 0.2,
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
      field: 'relation_type_vocabPair',
      headerName: 'Relationship to ',
      minWidth: 200,
      flex: 0.2,
      valueGetter: (params: GridCellParams) =>
        params.value !== undefined
          ? params.value[0]
          : props.relation_linked_vocab,
      renderCell: (params: GridCellParams) => (
        <Chip
          label={params.value}
          component={'span'}
          size={'small'}
          color={
            PARENT_CHILD_VOCAB.includes(params.value) ? 'secondary' : 'default'
          }
        />
      ),
    },
    {
      field: 'record_id',
      headerName: 'Last Updated By',
      minWidth: 100,
      valueGetter: () => '',
      flex: 0.4,
    },
  ];
  if(props.relation_type ==='Child')
  columns.push({
    field: 'prefered',
    headerName: 'Prefered',
    minWidth: 200,
    flex: 0.2,
    valueGetter: (params: GridCellParams) =>
      params.row.is_prefered??false,
    renderCell: (params: GridCellParams) => params.value?(
      <>Prefered</>
    ):(<></>),
  })
  return props.links !== null && props.links.length > 0 ? (
    <DataGrid
      autoHeight
      density={'compact'}
      pageSize={5}
      rowsPerPageOptions={[5]}
      disableSelectionOnClick
      componentsProps={{
        filterPanel: {sx: {maxWidth: '96vw'}},
      }}
      columns={columns}
      initialState={{
        sorting: {
          sortModel: [{field: 'lastUpdatedBy', sort: 'desc'}],
        },
      }}
      rows={props.links}
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
   * Display the linked records in a MUI Data Grid
   * Data Grid is set to autoHeight (grid will size according to its content) up to 5 rows
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
      props
        .handleUnlink(modalLink.record_id, modalLink.hrid)
        .then((result: string) => {
          console.debug('UnClick result', result);
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
    route: any
  ) {
    return record_id === current_record_id ? (
      <RecordRouteDisplay>This record</RecordRouteDisplay>
    ) : (
      <Typography variant={'body2'} fontWeight={'bold'}>
        <RecordRouteDisplay link={route}>
          {type + ' ' + hrid}
        </RecordRouteDisplay>
      </Typography>
    );
  }
  const columns: GridColumns = [
    {
      field: 'record',
      headerName: 'Record',
      minWidth: 200,
      flex: 0.2,
      valueGetter: (params: GridCellParams) =>
        params.row.type + ' ' + params.row.hrid,
      renderCell: (params: GridCellParams) =>
        recordDisplay(
          props.record_id,
          params.row.record_id,
          params.row.type,
          params.row.hrid,
          params.row.route
        ),
    },
    {
      field: 'relation_type_vocabPair',
      headerName: 'Relationship to ' + props.field_label,
      minWidth: 200,
      flex: 0.2,
      valueGetter: (params: GridCellParams) => params.value[0],
      renderCell: (params: GridCellParams) => (
        <Chip
          label={params.value}
          component={'span'}
          size={'small'}
          color={
            PARENT_CHILD_VOCAB.includes(params.value) ? 'secondary' : 'default'
          }
        />
      ),
    },
    {
      field: 'lastUpdatedBy',
      headerName: 'Last Updated By',
      minWidth: 100,
      valueGetter: (params: GridCellParams) => params.row.lastUpdatedBy,
      flex: 0.4,
    }
  ];
  // for read ONLY
  if(props.relation_type ==='Child'&&props.disabled !== true)
    columns.push({
      field: 'prefered',
      headerName: 'Make Prefered',
      minWidth: 200,
      flex: 0.2,
      valueGetter: (params: GridCellParams) =>
        params.row.relation_prefered??false,
      renderCell: (params: GridCellParams) => (
        <FormControlLabel control={<Checkbox checked={params.value} disabled={props.prefered!==undefined&&props.prefered!==null&&props.prefered!==params.row.record_id?true:false} onChange={(event: any) => {
          console.log(event.target.checked);
          if(props.handleMakePrefered!==undefined)
            props.handleMakePrefered(params.row.record_id,event.target.checked)
        }}
        />} label="Make Prefered" />
      ),
    })
  else if(props.relation_type ==='Child'&&props.disabled === true)
  columns.push({
    field: 'prefered',
    headerName: 'Make Prefered',
    minWidth: 200,
    flex: 0.2,
    valueGetter: (params: GridCellParams) =>
      params.row.relation_prefered??false,
    renderCell: (params: GridCellParams) => params.value?(
      <><CheckCircleIcon color="success" /> Prefered</>
    ):(<></>),
  })
  if (props.disabled !== true)
    columns.push({
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
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
                      <RecordRouteDisplay>
                        {modalLink.type} {modalLink.hrid}
                      </RecordRouteDisplay>
                      <Chip
                        component={'span'}
                        size={'small'}
                        color={
                          PARENT_CHILD_VOCAB.includes(
                            modalLink.relation_type_vocabPair[0]
                          )
                            ? 'secondary'
                            : 'default'
                        }
                        sx={{m: 1}}
                        label={modalLink.relation_type_vocabPair[0]}
                      />
                      <RecordRouteDisplay>
                        {modalLink.link.type}&nbsp;{modalLink.link.hrid}
                        &nbsp;&gt;&nbsp;{modalLink.link.field_label}
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
            pageSize={5}
            rowsPerPageOptions={[5]}
            disableSelectionOnClick
            components={{
              Footer: RecordLinksToolbar,
            }}
            componentsProps={{
              filterPanel: {sx: {maxWidth: '96vw'}},
            }}
            columns={columns}
            initialState={{
              sorting: {
                sortModel: [{field: 'lastUpdatedBy', sort: 'desc'}],
              },
            }}
            rows={props.links}
            getRowId={getRowId}
            checkboxSelection
          />
        </Box>
      )}
    </Box>
  );
}
