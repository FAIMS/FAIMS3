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

import React, {useEffect, useState} from 'react';
import {
  Alert,
  Box,
  ButtonGroup,
  Button,
  Typography,
  Modal,
  Paper,
  CircularProgress,
  Stack,
} from '@mui/material';
import {
  DataGrid,
  GridActionsCellItem,
  GridCellParams,
  GridRow,
  GridRowParams,
} from '@mui/x-data-grid';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import {RecordLinksToolbar} from '../toolbars';
import {RecordID, Record} from '@faims3/data-model';
import RecordRouteDisplay from '../../../ui/record_link';
import {RecordReference} from '@faims3/data-model';
import {gridParamsDataType} from '../record_links';
import {RecordLinkProps} from '../types';
import {getRecordInformation} from '../RelatedInformation';
import {R} from 'msw/lib/core/HttpResponse-B07UKAkU';

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
      headerName: 'Last Updated By',
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
  links: Array<RecordLinkProps> | null;
  record_id: RecordID;
  record_hrid: string;
  record_type: string;
  field_label: string;
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

  function ChildRecordDisplay(props: {
    current_record_id: RecordID;
    child_record: RecordLinkProps;
  }) {
    const [recordData, setRecordData] = useState<
      | {
          latest_record: null;
          revision_id: undefined;
        }
      | {
          latest_record: Record | null;
          revision_id: string;
        }
    >();

    const [childFields, setChildFields] = useState<Array<string>>([]);

    useEffect(() => {
      const fn = async () => {
        // get the record so we can display some fields
        const rd = await getRecordInformation(props.child_record);
        setRecordData(rd);
        console.log(rd);

        if (rd.latest_record) {
          const fields = Object.getOwnPropertyNames(
            rd.latest_record.data
          ).filter(
            (n: string) =>
              n !== 'fieldNames' && n !== 'views' && n !== 'updateField'
          );
          setChildFields(fields);
          console.log(fields);
        }
      };

      fn();
    }, [props.child_record]);

    if (props.child_record.record_id === props.current_record_id) {
      return <RecordRouteDisplay>This record</RecordRouteDisplay>;
    } else {
      return (
        <Stack>
          <Typography variant={'body2'} fontWeight={'bold'}>
            <RecordRouteDisplay
              link={props.child_record.deleted ? '' : props.child_record.route}
              deleted={props.child_record.deleted}
            >
              {props.child_record.type + ': ' + props.child_record.hrid}
            </RecordRouteDisplay>
          </Typography>
          {childFields.map(fieldName => {
            const value = recordData?.latest_record?.data[fieldName];
            if (typeof value === 'string')
              return (
                <Typography variant={'body2'}>
                  {fieldName}:{' '}
                  {recordData?.latest_record?.data[fieldName] || ''}
                </Typography>
              );
            else return <></>;
          })}
        </Stack>
      );
    }
  }

  const xx = {
    latest_record: {
      project_id: 'development-faims-server||1727833559528-rapid-impact-survey',
      record_id: 'rec-914ff804-a35c-4848-9642-9e7f00ee7d52',
      revision_id: 'frev-479906db-bb67-4599-a4a5-0947cf058ac3',
      type: 'Building',
      data: {
        'hridBuilding-Building-Details': 'Building: Mobile-NNN',
        'Building-Identifier': 'My House',
        'Structure-Type': 'Mobile',
        'Building-Location': {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [150.95982747559432, -33.75271099772671],
              },
              properties: null,
            },
          ],
        },
        'Building-Damage': 'Damage',
        'building-hazards': 'Yes',
        'Hazard-Details': 'A big mess.',
        'Building-Photograph': null,
        fieldNames: [],
        views: [],
        updateField: 'Hazard-Details',
      },
      updated_by: 'admin',
      updated: '2024-10-03T03:47:55.196Z',
      created: '2024-10-03T03:47:55.196Z',
      created_by: 'admin',
      deleted: false,
    },
    revision_id: 'frev-479906db-bb67-4599-a4a5-0947cf058ac3',
  };

  const relation_column = {
    field: 'relation_type_vocabPair',
    headerName: 'Relationship',
    headerClassName: 'faims-record-link--header',
    minWidth: 200,
    flex: 0.2,
    valueGetter: (params: gridParamsDataType) => params.value[1],
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
        child_record={params.row}
      />
    ),
  };

  const updated_by_column = {
    field: 'lastUpdatedBy',
    headerName: 'Last Updated By',
    headerClassName: 'faims-record-link--header',
    minWidth: 150,
    flex: 0.2,
    valueGetter: (params: GridCellParams) => params.row.lastUpdatedBy,
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

  console.log('Data Grid', props);

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
