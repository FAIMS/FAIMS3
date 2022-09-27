import React from 'react';
import {
  Button,
  Divider,
  Grid,
  Typography,
  ButtonProps,
  Collapse,
  Link,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {styled} from '@mui/material/styles';
import {RecordProps} from './types';
import {
  DataGrid,
  GridCellParams,
  GridColDef,
  GridEventListener,
} from '@mui/x-data-grid';
import ArticleIcon from '@mui/icons-material/Article';
import {CreateRecordLink, RelationshipType} from './create_record_link';
interface LinkedRecordProps {
  linked_records: Array<RecordProps> | null;
  relationships: Array<RelationshipType>;
}
interface ExpandMoreProps extends ButtonProps {
  expand: boolean;
}

const ExpandMoreButton = styled((props: ExpandMoreProps) => {
  const {expand, ...other} = props;
  return <Button {...other} />;
})(({theme, expand}) => ({
  '	.MuiButton-endIcon': {
    transform: !expand ? 'rotate(0deg)' : 'rotate(180deg)',
    marginLeft: 'auto',
    transition: theme.transitions.create('transform', {
      duration: theme.transitions.duration.shortest,
    }),
  },
}));
export default function LinkedRecords(props: LinkedRecordProps) {
  const handleRowClick: GridEventListener<'rowClick'> = params => {
    // history.push(params.row.route);
    alert('go to row route');
  };
  // is the new link functionality visible
  const [expanded, setExpanded] = React.useState(false);

  const handleExpandClick = () => {
    setExpanded(!expanded);
  };

  const columns: GridColDef[] = [
    {
      field: 'article_icon',
      headerName: '',
      type: 'string',
      width: 30,
      renderCell: (params: GridCellParams) => <ArticleIcon sx={{my: 2}} />,
      hide: false,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
    },
    {
      field: 'type',
      headerName: 'Kind',
      flex: 0.2,
      minWidth: 100,
    },
    {
      field: 'hrid',
      headerName: 'HRID',
      flex: 0.2,
      minWidth: 70,
      renderCell: (params: GridCellParams) => (
        <Link underline={'none'} sx={{fontWeight: 'bold'}}>
          {params.value}
        </Link>
      ),
    },
    {
      field: 'lastUpdatedBy',
      headerName: 'Last Updated',
      flex: 0.4,
      minWidth: 300,
    },
    {
      field: 'description',
      headerName: 'relationship',
      flex: 0.2,
      minWidth: 100,
    },
    {field: 'route', hide: true, filterable: false},
    {
      field: 'record_id',
      headerName: 'UUID',
      description: 'UUID Record ID',
      type: 'string',
      hide: true,
    },
  ];
  return (
    <React.Fragment>
      <Grid
        container
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={1}
      >
        <Grid item xs={'auto'}>
          <Typography variant={'h6'}>Linked records</Typography>
        </Grid>
        <Grid item xs>
          <Divider />
        </Grid>
        <Grid item>
          <ExpandMoreButton
            size={'small'}
            disableElevation
            expand={expanded}
            onClick={handleExpandClick}
            aria-expanded={expanded}
            aria-label="show more"
            endIcon={<ExpandMoreIcon />}
          >
            New Link
          </ExpandMoreButton>
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Collapse in={expanded} timeout="auto" unmountOnExit sx={{mt: 1}}>
            <CreateRecordLink relationships={props.relationships} />
          </Collapse>
        </Grid>

        {props.linked_records !== null && (
          <Grid item xs={12}>
            <DataGrid
              autoHeight
              getRowId={r => r.record_id}
              initialState={{
                columns: {
                  columnVisibilityModel: {
                    // Hide column route, the other columns will remain visible
                    route: false,
                    record_id: false,
                  },
                },
              }}
              density={'compact'}
              rows={props.linked_records}
              columns={columns}
              pageSize={5}
              rowsPerPageOptions={[5]}
              disableSelectionOnClick
              onRowClick={handleRowClick}
              sx={{borderRadius: '0', cursor: 'pointer', border: 'none'}}
            />
          </Grid>
        )}
      </Grid>
    </React.Fragment>
  );
}
