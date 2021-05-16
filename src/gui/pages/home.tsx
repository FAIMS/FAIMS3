import React, {useContext} from 'react';
import {makeStyles} from '@material-ui/core/styles';
import {NavLink} from 'react-router-dom';
import {Container, Breadcrumbs, Typography, Box, Grid} from '@material-ui/core';
import Skeleton from '@material-ui/lab/Skeleton';
import ProjectCard from '../components/projectCard';
import * as ROUTES from '../../constants/routes';
import {store} from '../../store';
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
  const globalState = useContext(store);
  const projectList = globalState.state.project_list;
  return (
    <Container maxWidth="md">
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
          {Object.keys(projectList).length === 0
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
                    />
                  </Skeleton>
                </Grid>
              ))
            : Object.keys(projectList).map(key => {
                return (
                  <Grid
                    item
                    xs={12}
                    sm={4}
                    md={4}
                    key={'project-list-grid' + projectList[key]._id}
                  >
                    <ProjectCard project={projectList[key]} />
                  </Grid>
                );
              })}
        </Grid>
      </div>
      <Typography variant="overline">Recent Observations</Typography>
    </Container>
  );
}
