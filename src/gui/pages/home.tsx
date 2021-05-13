import React, {useState} from 'react';
import {makeStyles} from '@material-ui/core/styles';
import {NavLink} from 'react-router-dom';
import {Container, Breadcrumbs, Typography, Box, Grid} from '@material-ui/core';
import ProjectCard from '../components/projectCard';
import * as ROUTES from '../../constants/routes';
import {dummy_projects} from '../../dummyData';
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
}));

export default function Home() {
  const classes = useStyles();
  const [projects] = useState(dummy_projects);

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
      <Typography variant="overline">Projects</Typography>
      <div className={classes.gridRoot}>
        <Grid container spacing={1}>
          {projects.map(project => {
            return (
              <Grid
                item
                xs={12}
                sm={4}
                md={4}
                key={'project-card' + project._id}
              >
                <ProjectCard project={project} />
              </Grid>
            );
          })}
        </Grid>
      </div>
      <Typography variant="overline">Observations</Typography>
    </Container>
  );
}
