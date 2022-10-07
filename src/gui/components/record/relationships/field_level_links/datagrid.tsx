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
import {NavLink} from 'react-router-dom';
import {
  Alert,
  Box,
  ButtonGroup,
  Button,
  Grid,
  Link,
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
} from '@mui/x-data-grid';
import {DataGridLinksComponentProps} from '../types';
import ArticleIcon from '@mui/icons-material/Article';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import {RecordLinksToolbar} from '../toolbars';

const style = {
  position: 'absolute' as const,
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  p: 1,
};

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
  function getRowId(row: any) {
    /***
     * Provide a unique row id for each row
     */
    return (
      row.record_id +
      row.field_id +
      row.relation_type_vocabPair[0] +
      row.link.record_id
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
    alert('delete ' + modalLink.link_id);
  }
  const columns: GridColumns = [
    {
      field: 'linked_record',
      headerName: 'Linked Record',
      headerClassName: 'faims-record-link--header',
      minWidth: 300,
      flex: 0.4,
      valueGetter: (params: GridCellParams) =>
        params.row.link.type + ' ' + params.row.link.hrid,
      renderCell: (params: GridCellParams) => (
        <Typography variant={'body2'} fontWeight={'bold'}>
          <Link
            component={NavLink}
            to={params.row.link.route}
            underline={'none'}
          >
            <Grid
              container
              direction="row"
              alignItems="center"
              component={'span'}
            >
              <ArticleIcon fontSize={'inherit'} sx={{mr: '3px'}} />
              {params.value}
            </Grid>
          </Link>
        </Typography>
      ),
    },
    {
      field: 'lastUpdatedBy',
      headerName: 'Last Updated By',
      headerClassName: 'faims-record-link--header',
      minWidth: 100,
      valueGetter: (params: GridCellParams) => params.row.link.lastUpdatedBy,
      flex: 0.4,
    },

    {
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
    },
  ];
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
            density={'compact'}
            pageSize={5}
            rowsPerPageOptions={[5]}
            disableSelectionOnClick
            components={{
              Footer: RecordLinksToolbar,
            }}
            columns={columns}
            initialState={{
              sorting: {
                sortModel: [{field: 'lastUpdatedBy', sort: 'desc'}],
              },
            }}
            rows={props.links}
            getRowId={getRowId}
          />
        </Box>
      )}
    </Box>
  );
}
