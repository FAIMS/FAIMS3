import React from 'react';
import {Box, Paper, Chip, Link, Typography} from '@mui/material';
import {
  DataGrid,
  GridActionsCellItem,
  GridCellParams,
  GridRowParams,
} from '@mui/x-data-grid';
import {NavLink} from 'react-router-dom';
import EditIcon from '@mui/icons-material/Edit';
import {RecordLinksComponentProps, PARENT_CHILD_VOCAB} from './types';
import {RecordLinksToolbar} from './toolbars';
import {RecordID} from '../../../../datamodel/core';
import RecordRouteDisplay from '../../ui/record_link';

export default function RecordLinkComponent(props: RecordLinksComponentProps) {
  /***
   * This component has two 'views' depending on whether the data is from record to field, or field to record.
   * is_field is the switch that toggles how the datagrid treats the data.
   * If is_field is false, the data input are assumed to be in relation to a record, i.e.,
   * what fields from other records point to this record?
   * If is_field is true, the data input are assumed to be in relation to the current record's fields, i.e.,
   * show me a list of all the fields in this record that have linked records (child or related).
   * @param row
   */
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
      <RecordRouteDisplay link={route}>{type + ' ' + hrid}</RecordRouteDisplay>
    );
  }

  if (props.record_links !== null) {
    const columns = [
      {
        field: 'record',
        headerName: 'Record',
        headerClassName: 'faims-record-link--header',
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
        headerName: 'Relationship',
        headerClassName: 'faims-record-link--header',
        minWidth: 200,
        flex: 0.2,
        valueGetter: (params: GridCellParams) =>
          props.record_id === params.row.record_id
            ? params.value[0]
            : params.value[1],
        renderCell: (params: GridCellParams) => (
          <Chip
            label={params.value}
            component={'span'}
            size={'small'}
            color={
              PARENT_CHILD_VOCAB.includes(params.value)
                ? 'secondary'
                : 'default'
            }
          />
        ),
      },
      {
        field: 'linked_record',
        headerName: 'Linked record',
        headerClassName: 'faims-record-link--header',
        minWidth: 150,
        flex: 0.2,
        valueGetter: (params: GridCellParams) =>
          params.row.link.type + params.row.link.hrid,
        renderCell: (params: GridCellParams) =>
          recordDisplay(
            props.record_id,
            params.row.link.record_id,
            params.row.link.type,
            params.row.link.hrid,
            params.row.link.route
          ),
      },
      {
        field: 'linked_section',
        headerName: 'Section',
        headerClassName: 'faims-record-link--header',
        minWidth: 150,
        flex: 0.15,
        valueGetter: (params: GridCellParams) => params.row.link.section_label,
        renderCell: (params: GridCellParams) => (
          <Typography variant={'body2'} fontWeight={'bold'}>
            <Link
              component={NavLink}
              to={params.row.link.route}
              underline={'none'}
              onClick={() => props.handleSetSection(params.row.link.section)}
            >
              {params.value}
            </Link>
          </Typography>
        ),
      },
      {
        field: 'linked_field',
        headerName: 'Field',
        headerClassName: 'faims-record-link--header',
        minWidth: 150,
        flex: 0.15,
        valueGetter: (params: GridCellParams) => params.row.link.field_label,
        renderCell: (params: GridCellParams) => (
          <Typography variant={'body2'} fontWeight={'bold'}>
            <Link
              component={NavLink}
              to={{pathname:params.row.link.route,
                hash: '#' + params.row.link.field_id}}
              underline={'none'}
            >
              {params.value}
            </Link>
          </Typography>
        ),
      },
      {
        field: 'lastUpdatedBy',
        headerName: 'Last Updated By',
        headerClassName: 'faims-record-link--header',
        minWidth: 300,
        flex: 0.2,
      },
      {
        field: 'actions',
        type: 'actions',
        headerName: 'Actions',
        headerClassName: 'faims-record-link--header',
        flex: 0.1,
        minWidth: 100,
        getActions: (params: GridRowParams) => [
          <GridActionsCellItem
            icon={<EditIcon color={'primary'} />}
            onClick={() => {
              alert('go to record>section>field');
              console.debug(params);
            }}
            label="Edit link"
            showInMenu
          />,
        ],
      },
    ];
    return (
      <Box component={Paper} elevation={0}>
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
          // initialState={{
          //   sorting: {
          //     sortModel: [{field: 'lastUpdatedBy', sort: 'asc'}],
          //   },
          // }}
          rows={props.record_links}
          getRowId={getRowId}
          className={'test'}
          sx={
            {
              // borderLeft: 'none',
              // borderRight: 'none',
              // borderTop: 'none',
              // '& .MuiDataGrid-columnHeaders': {
              //   borderRadius: 0,
              // },
            }
          }
        />
      </Box>
    );
  } else {
    return <Box></Box>;
  }
}
