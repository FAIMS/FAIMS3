import React from 'react';
import {makeStyles} from '@material-ui/core/styles';
import {Link as RouterLink, NavLink} from 'react-router-dom';
import {
  Container,
  Breadcrumbs,
  Typography,
  Box,
  Grid,
  Paper,
  Link,
} from '@material-ui/core';
import Skeleton from '@material-ui/lab/Skeleton';
import ProjectCard from '../components/projectCard';
import * as ROUTES from '../../constants/routes';
// import {store} from '../../store';
import {getProjectInfo, getProjectList} from '../../databaseAccess';
import DashboardActions from '../components/dashboard/actions';
import TimelapseIcon from '@material-ui/icons/Timelapse';
const useStyles = makeStyles(theme => ({
  gridRoot: {
    flexGrow: 1,
  },
  container: {
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(4),
  },
  paper: {
    padding: theme.spacing(2),
    display: 'flex',
    overflow: 'auto',
    flexDirection: 'column',
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

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="overline">Add new Observation</Typography>
          <Paper className={classes.paper}>
            <DashboardActions pouchProjectList={pouchProjectList} />
          </Paper>
        </Grid>
        {/* Recent Observations */}
        <Grid item xs={12} md={8} lg={9}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <Typography variant="overline" display={'inline'}>
              Recent Observations&nbsp;&nbsp;
            </Typography>
            <TimelapseIcon color={'secondary'} style={{fontSize: '1.1rem'}} />
          </div>

          <Paper className={classes.paper}>
            {/*<Observations />*/}
            <Box mt={2}>
              <Link
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
                component={RouterLink}
                to={ROUTES.OBSERVATION_LIST}
              >
                See more observations
                {/*<ChevronRightIcon />*/}
              </Link>
            </Box>
          </Paper>
        </Grid>
        {/* Recent Projects */}
        <Grid item xs={12} md={4} lg={3}>
          <Typography variant="overline">My Projects</Typography>
          <Paper className={classes.paper}>
            <Grid container spacing={1}>
              {Object.keys(pouchProjectList).length === 0
                ? [...Array(3)].map((e, i) => (
                    <Grid item xs={12} key={'skeleton-project-list-grid' + i}>
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
                          key={'project-list-grid' + pouchProject._id}
                        >
                          <ProjectCard
                            project={pouchProject}
                            listing_id_project_id={listing_id_project_id}
                            dashboard={true}
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
            <Box mt={2}>
              <Link
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
                component={RouterLink}
                to={ROUTES.PROJECT_LIST}
              >
                View all projects
                {/*<ChevronRightIcon />*/}
              </Link>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}
