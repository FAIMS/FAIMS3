import React, {useContext, useEffect, useState} from 'react';
import {NavLink, useParams} from 'react-router-dom';
import {
  Box,
  Breadcrumbs,
  CircularProgress,
  Container,
  Typography,
} from '@material-ui/core';
import ProjectCard from '../components/projectCard';
import * as ROUTES from '../../constants/routes';

import {store} from '../../store';
import {ActionType} from '../../actions';
import {getProject} from '../../databaseAccess';

export default function Project() {
  const {project_id} = useParams<{project_id: string}>();
  const [loading, setLoading] = useState(true);
  const globalState = useContext(store);
  const {dispatch} = globalState;
  const projectList = globalState.state.project_list;
  const project = projectList[project_id];

  // if the project isn't already in the project_list
  useEffect(() => {
    if (typeof project === 'undefined' || Object.keys(project).length === 0) {
      const timer = setTimeout(() => {
        dispatch({
          type: ActionType.GET_PROJECT,
          payload: getProject(project_id),
        });
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setLoading(false);
    }
    return;
  }, []);

  useEffect(() => {
    if (typeof project !== 'undefined' && Object.keys(project).length > 0) {
      setLoading(false);
    }
  }, [project]);

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
          <NavLink to={ROUTES.PROJECT_LIST}>Projects</NavLink>
          <Typography color="textPrimary">{project_id}</Typography>
        </Breadcrumbs>
      </Box>
      <h3>project_id: {project_id}</h3>
      {loading ? (
        <CircularProgress size={12} thickness={4} />
      ) : (
        <ProjectCard project={project} showObservations={true} />
      )}
    </Container>
  );
}
