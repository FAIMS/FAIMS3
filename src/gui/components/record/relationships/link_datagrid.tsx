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
 * Filename: relationships/index.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import {NavLink} from 'react-router-dom';
import {
  Alert,
  Box,
  ButtonGroup,
  Button,
  Divider,
  Grid,
  Typography,
  Modal,
  Paper,
} from '@mui/material';
import {
  DataGrid,
  GridActionsCellItem,
  GridCellParams,
  GridColumns,
  GridRow,
  GridRowParams,
  GridToolbarContainer,
  GridToolbarFilterButton,
} from '@mui/x-data-grid';
import {DataGridLinksComponentProps} from './types';
import ArticleIcon from '@mui/icons-material/Article';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
const style = {
  position: 'absolute' as const,
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  p: 1,
};

export function DataGridToolbar() {
  return (
    <GridToolbarContainer>
      <Grid
        container
        spacing={2}
        justifyContent="space-between"
        alignItems="center"
      >
        <Grid item>
          <GridToolbarFilterButton />
        </Grid>
      </Grid>
    </GridToolbarContainer>
  );
}
export default function DataGridLinksComponent(
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
    console.error('Unlink', modalLink);
    props.handleUnlink(
      modalLink.recordB_id,
      modalLink.recordB_hrid
      // modalLink.field,
      // modalLink.recordA_id
    );
    setModalOpen(false);
  }
  const columns: GridColumns = [
    {
      field: 'recordA_section',
      headerName: 'Section',
      type: 'string',
      renderCell: (params: GridCellParams) => (
        <Typography variant={'h6'} sx={{textTransform: 'capitalise'}}>
          {params.value}
        </Typography>
      ),
      minWidth: 100,
    },
    {
      field: 'recordA_field_label',
      headerName: 'Field',
      minWidth: 100,
    },
    {
      field: 'relation_type_vocabPair',
      headerName: 'relationship',
      minWidth: 100,
      valueGetter: (params: GridCellParams) => params.value[0],
    },
    {
      field: 'recordB_type',
      headerName: 'Kind',
      minWidth: 100,
    },
    {
      field: 'recordB_hrid',
      headerName: 'HRID',
      minWidth: 365,
      renderCell: (params: GridCellParams) => (
        <Button
          component={NavLink}
          to={{
            pathname: params.row.recordB_route, // update for get record_id persistence for the draft
            state: props.state,
          }}
          variant={'text'}
        >
          <Grid container direction="row" alignItems="center" spacing={'4px'}>
            <ArticleIcon fontSize={'inherit'} /> {params.value}
          </Grid>
        </Button>
      ),
    },
    {
      field: 'recordB_lastUpdatedBy',
      headerName: 'Last Updated',
      minWidth: 300,
    },
    {field: 'recordB_route', hide: true, filterable: false},
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      getActions: (params: GridRowParams) => [
        <GridActionsCellItem
          icon={<LinkOffIcon color={'error'} />}
          onClick={handleModalOpen(params.row)}
          label="Remove link"
          showInMenu
        />,
      ],
    },
  ];
  return (
    <Box component={Paper} elevation={0}>
      {props.show_title ? (
        <Grid
          container
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          spacing={1}
        >
          <Grid item xs={'auto'}>
            <Grid
              container
              spacing={1}
              justifyContent={'center'}
              alignItems={'flex-start'}
            >
              <Grid item>
                <LinkIcon fontSize={'inherit'} sx={{mt: '3px'}} />
              </Grid>
              <Grid item>
                <Typography variant={'h6'}>{props.title}</Typography>
              </Grid>
            </Grid>
          </Grid>
          <Grid item xs>
            <Divider />
          </Grid>
        </Grid>
      ) : (
        ''
      )}
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
                    Do you wish to remove the link <br />
                    <Typography
                      variant="body2"
                      fontStyle={'italics'}
                      component={'span'}
                    >
                      {modalLink.recordA_type} {modalLink.recordA_hrid}{' '}
                      <strong>{modalLink.recordA_field_label}</strong>{' '}
                      <i>{modalLink.relation_type_vocabPair[0]}</i>{' '}
                      {modalLink.recordB_hrid}?
                    </Typography>
                  </Alert>
                  <ButtonGroup fullWidth disableElevation>
                    <Button onClick={handleUnlink} variant={'contained'}>
                      Unlink
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
            initialState={{
              columns: {
                columnVisibilityModel: {
                  recordA_id: false,
                  recordA_hrid: false,
                  recordA_type: false,
                  recordA_field_id: false,
                  recordA_section: props.show_section,
                  recordA_field_label: props.show_field,
                  recordB_id: false,
                  recordB_route: false,
                  relation_type_vocabPair: props.show_link_type,
                  actions: props.handleUnlink === undefined ? false : true,
                },
              },
            }}
            getRowId={r => r.recordA_id + r.field_id + r.recordB_id}
            density={'compact'}
            rows={props.links}
            columns={columns}
            pageSize={5}
            rowsPerPageOptions={[5]}
            disableSelectionOnClick
            components={{
              Toolbar: DataGridToolbar,
            }}
            sx={{cursor: 'pointer', borderWidth: props.show_title ? 0 : '1px'}}
          />
        </Box>
      )}
    </Box>
  );
}
