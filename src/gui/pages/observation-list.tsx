import React from 'react';
import {makeStyles} from '@material-ui/core/styles';
import {NavLink} from 'react-router-dom';
import {Container, Breadcrumbs, Typography, Box, Grid} from '@material-ui/core';
import * as ROUTES from '../../constants/routes';
import Skeleton from '@material-ui/lab/Skeleton';
const useStyles = makeStyles(theme => ({
  gridRoot: {
    flexGrow: 1,
    padding: theme.spacing(2),
  },
  bullet: {
    display: 'inline-block',
    margin: '0 2px',
    transform: 'scale(0.8)',
  },
  title: {
    fontSize: 14,
  },
  pos: {
    marginBottom: 12,
  },
  avatar: {
    borderRadius: 8,
    // backgroundColor: red[500],
    backgroundColor: theme.palette.secondary.light,
  },
  overline: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: 500,
  },
}));

export default function ObservationList() {
  const classes = useStyles();
  // const globalState = useContext(store);
  const pouchObservationList = {};

  return (
    <Container maxWidth="lg">
      <Box display="flex" flexDirection="row-reverse" p={1} m={1}>
        <Breadcrumbs aria-label="breadcrumb">
          <NavLink to={ROUTES.INDEX}>Index</NavLink>
          <Typography color="textPrimary">Observations</Typography>
        </Breadcrumbs>
      </Box>

      <div className={classes.gridRoot}>
        <Grid container spacing={1}>
          <Grid item xs={12} key={'skeleton-observation-list-grid'}>
            <Skeleton animation="wave" variant="rect" height={100}/>
          </Grid>
          To be implemented... Observation list component - list of observation user has access to: -
          shows most recent (top 100) - allows for filtering by meta data
          (owner, last_updated by, project etc)
        </Grid>
      </div>
    </Container>
  );
}
