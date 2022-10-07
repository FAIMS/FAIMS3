import React from 'react';
import {Box, Chip, Grid, Link, Typography} from '@mui/material';
import {DataGrid, GridCellParams} from '@mui/x-data-grid';
import {NavLink} from 'react-router-dom';
import ArticleIcon from '@mui/icons-material/Article';
import {RecordLinksComponentProps} from './types';
import {RecordLinksToolbar} from './toolbars';
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
    if (props.is_field) {
      return (
        row.record_id +
        row.field_id +
        row.relation_type_vocabPair[0] +
        row.link.record_id
      );
    } else {
      return row.record_id + row.field_id + row.relation_type_vocabPair[0];
    }
  }
  const PARENT_CHILD_VOCAB = ['has child', 'is parent'];

  if (props.record_links !== null) {
    const columns = props.is_field
      ? [
          {
            field: 'section',
            headerName: 'Section',
            headerClassName: 'faims-record-link--header',
            minWidth: 100,
            flex: 0.2,
            renderCell: (params: GridCellParams) => (
              <Typography variant={'body2'} fontWeight={'bold'}>
                <Link
                  component={NavLink}
                  to={params.row.route}
                  underline={'none'}
                >
                  {params.value}
                </Link>
              </Typography>
            ),
          },
          {
            field: 'field_label',
            headerName: 'Field',
            headerClassName: 'faims-record-link--header',
            minWidth: 100,
            flex: 0.2,
            renderCell: (params: GridCellParams) => (
              <Typography variant={'body2'} fontWeight={'bold'}>
                <Link
                  component={NavLink}
                  to={params.row.route}
                  underline={'none'}
                >
                  {params.value}
                </Link>
              </Typography>
            ),
          },
          {
            field: 'relation_type_vocabPair',
            headerName: 'Relationship',
            headerClassName: 'faims-record-link--header',
            minWidth: 100,
            flex: 0.2,
            valueGetter: (params: GridCellParams) => params.value[0],
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
            headerName: 'Linked Record',
            headerClassName: 'faims-record-link--header',
            minWidth: 300,
            flex: 0.2,
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
            valueGetter: (params: GridCellParams) =>
              params.row.link.lastUpdatedBy,
            flex: 0.2,
          },
        ]
      : [
          {
            field: 'relation_type_vocabPair',
            headerName: 'Relationship',
            headerClassName: 'faims-record-link--header',
            minWidth: 100,
            flex: 0.2,
            valueGetter: (params: GridCellParams) => params.value[0],
            renderCell: (params: GridCellParams) => (
              <Chip
                label={params.value}
                size={'small'}
                component={'span'}
                color={
                  PARENT_CHILD_VOCAB.includes(params.value)
                    ? 'secondary'
                    : 'default'
                }
              />
            ),
          },
          {
            field: 'hrid',
            headerName: 'Record',
            headerClassName: 'faims-record-link--header',
            minWidth: 300,
            flex: 0.8,
            valueGetter: (params: GridCellParams) =>
              params.row.type + params.row.hrid,
            renderCell: (params: GridCellParams) => (
              <Typography variant={'body2'} fontWeight={'bold'}>
                <Grid container>
                  <Grid item>
                    <Link
                      component={NavLink}
                      to={params.row.route}
                      underline={'none'}
                    >
                      <Grid
                        container
                        direction="row"
                        alignItems="center"
                        component={'span'}
                      >
                        <ArticleIcon fontSize={'inherit'} sx={{mr: '3px'}} />
                        {params.row.type} {params.row.hrid}
                      </Grid>
                    </Link>
                  </Grid>
                  <Grid item>
                    {params.row.section ? (
                      <span>
                        &nbsp;&gt;&nbsp;
                        <Link
                          component={NavLink}
                          to={params.row.route}
                          underline={'none'}
                        >
                          {params.row.section}
                        </Link>
                      </span>
                    ) : (
                      ''
                    )}
                  </Grid>
                  <Grid item>
                    {params.row.field_label ? (
                      <span>
                        &nbsp;&gt;&nbsp;
                        <Link
                          component={NavLink}
                          to={params.row.route}
                          underline={'none'}
                        >
                          {params.row.field_label}
                        </Link>
                      </span>
                    ) : (
                      ''
                    )}
                  </Grid>
                </Grid>
              </Typography>
            ),
          },
        ];
    return (
      <Box>
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
              sortModel: props.is_field
                ? [{field: 'section', sort: 'asc'}]
                : [{field: 'relation_type_vocabPair', sort: 'asc'}],
            },
          }}
          rows={props.record_links}
          getRowId={getRowId}
        />
      </Box>
    );
  } else {
    return <Box></Box>;
  }
}
