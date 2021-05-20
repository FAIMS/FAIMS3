import React from 'react';
import {makeStyles} from '@material-ui/core/styles';
import {NavLink} from 'react-router-dom';
import {Container, Breadcrumbs, Typography, Box, Grid} from '@material-ui/core';
import Skeleton from '@material-ui/lab/Skeleton';
import ProjectCard from '../components/projectCard';
import * as ROUTES from '../../constants/routes';
// import {store} from '../../store';
import {getProjectInfo, getProjectList} from '../../databaseAccess';
const useStyles = makeStyles(theme => ({
  gridRoot: {
    flexGrow: 1,
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
}));

export default function Home() {
  const classes = useStyles();
  // const globalState = useContext(store);
  const pouchProjectList = getProjectList();

  return (
    <Container maxWidth="lg">
      <Box
        display="flex"
        flexDirection="row-reverse"
        p={1}
        m={1}
        // bgcolor="background.paper"
      >
        <Breadcrumbs aria-label="breadcrumb">
          <NavLink to={ROUTES.INDEX}>Index</NavLink>
          <Typography color="textPrimary">Home</Typography>
        </Breadcrumbs>
      </Box>
      <Typography variant="overline">Latest Projects</Typography>
      <div className={classes.gridRoot}>
        <Grid container spacing={1}>
          {Object.keys(pouchProjectList).length === 0
            ? [...Array(3)].map((e, i) => (
                <Grid
                  item
                  xs={12}
                  sm={4}
                  md={4}
                  key={'skeleton-project-list-grid' + i}
                >
                  <Skeleton animation="wave" variant="rect">
                    <ProjectCard
                      project={{
                        name: 'dummy',
                        description: 'dummy',
                        _id: 'dummy',
                      }}
                      listing_id_project_id={'dummy'}
                    />
                  </Skeleton>
                </Grid>
              ))
            : Object.keys(pouchProjectList).map(listing_id_project_id => {
                const pouchProject = getProjectInfo(listing_id_project_id);
                if (pouchProject !== null) {
                  return (
                    <Grid
                      item
                      xs={12}
                      sm={4}
                      md={4}
                      key={'project-list-grid' + pouchProject._id}
                    >
                      <ProjectCard
                        project={pouchProject}
                        listing_id_project_id={listing_id_project_id}
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
      <Typography variant="overline">Recent Observations</Typography>
    </Container>
  );
}
