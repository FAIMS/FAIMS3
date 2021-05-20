import React from 'react';
import {makeStyles} from '@material-ui/core/styles';
import {NavLink} from 'react-router-dom';
import {Container, Breadcrumbs, Typography, Box, Grid} from '@material-ui/core';
import ProjectCard from '../components/projectCard';
import * as ROUTES from '../../constants/routes';
// import {store} from '../../store';
import {getProjectList} from '../../databaseAccess';
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

export default function ProjectList() {
  const classes = useStyles();
  // const globalState = useContext(store);
  const pouchProjectList = getProjectList();

  return (
    <Container maxWidth="lg">
      <Box display="flex" flexDirection="row-reverse" p={1} m={1}>
        <Breadcrumbs aria-label="breadcrumb">
          <NavLink to={ROUTES.INDEX}>Index</NavLink>
          <Typography color="textPrimary">Projects</Typography>
        </Breadcrumbs>
      </Box>

      <div className={classes.gridRoot}>
        <Grid container spacing={1}>
          {Object.keys(pouchProjectList).length === 0
            ? [...Array(3)].map((e, i) => (
                <Grid item xs={12} key={'skeleton-project-list-grid' + i}>
                  <Skeleton animation="wave" variant="rect">
                    <ProjectCard
                      project={{
                        _id: 'dummy',
                        name: 'dummy',
                        description: 'dummy',
                      }}
                      showObservations={true}
                      listing_id_project_id={'dummy'}
                    />
                  </Skeleton>
                </Grid>
              ))
            : Object.keys(pouchProjectList).map(listing_id_project_id => {
                const pouchProject = pouchProjectList[listing_id_project_id];
                if (pouchProject !== null) {
                  return (
                    <Grid
                      item
                      xs={12}
                      key={'project-list-grid' + pouchProject.project._id}
                    >
                      <ProjectCard
                        project={pouchProject.project}
                        listing_id_project_id={listing_id_project_id}
                        showObservations={true}
                      />
                    </Grid>
                  );
                } else {
                  return (
                    <Grid
                      item
                      xs={12}
                      key={'project-list-grid' + listing_id_project_id}
                    >
                      Project could not be loaded
                    </Grid>
                  );
                }
              })}
        </Grid>
      </div>
    </Container>
  );
}
