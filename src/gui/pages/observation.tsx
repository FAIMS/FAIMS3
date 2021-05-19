import React from 'react';
import {Box, Breadcrumbs, Container, Typography} from '@material-ui/core';
import {NavLink, useParams} from 'react-router-dom';
import * as ROUTES from '../../constants/routes';

export default function Observation() {
  const {project_id, observation_id} = useParams<{
    project_id: string;
    observation_id: string;
  }>();
  return (
    <Container maxWidth="md">
      <Box display="flex" flexDirection="row-reverse" p={1} m={1}>
        <Breadcrumbs aria-label="breadcrumb">
          <NavLink to={ROUTES.INDEX}>Index</NavLink>
          <NavLink to={ROUTES.PROJECT_LIST}>Projects</NavLink>
          <NavLink to={ROUTES.PROJECT + project_id}>
            Project {project_id}
          </NavLink>
          <Typography color="textPrimary">{observation_id}</Typography>
        </Breadcrumbs>
      </Box>
      <h3>project_id: {project_id}</h3>
      <h3>observation_id: {observation_id}</h3>
      In Progress: revisions, edit & update tab
    </Container>
  );
}
