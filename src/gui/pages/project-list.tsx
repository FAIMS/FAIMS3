import React, {useContext} from 'react';
import {makeStyles} from '@material-ui/core/styles';
import {NavLink} from 'react-router-dom';
import {Container, Breadcrumbs, Typography, Box, Grid} from '@material-ui/core';
import ProjectCard from '../components/projectCard';
import * as ROUTES from '../../constants/routes';
import {store} from '../../store';
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

  const globalState = useContext(store);
  const projectList = globalState.state.project_list;

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
          <Typography color="textPrimary">Projects</Typography>
        </Breadcrumbs>
      </Box>

      <div className={classes.gridRoot}>
        <Grid container spacing={1}>
          {Object.keys(projectList).length === 0
            ? [...Array(3)].map((e, i) => (
                <Grid item xs={12} key={'skeleton-project-list-grid' + i}>
                  <Skeleton animation="wave" variant="rect">
                    <ProjectCard
                      project={{
                        name: 'dummy',
                        description: 'dummy',
                        _id: 'dummy',
                      }}
                      showObservations={true}
                    />
                  </Skeleton>
                </Grid>
              ))
            : Object.keys(projectList).map(key => {
                return (
                  <Grid
                    item
                    xs={12}
                    key={'project-list-grid' + projectList[key]._id}
                  >
                    <ProjectCard
                      project={projectList[key]}
                      showObservations={true}
                    />
                  </Grid>
                );
              })}
        </Grid>
      </div>
    </Container>
  );
}
