import React from 'react';
import {
  Box,
  Breadcrumbs,
  Container,
  Typography,
  Paper,
} from '@material-ui/core';
import {NavLink, useParams} from 'react-router-dom';
import * as ROUTES from '../../constants/routes';
import {ProjectID} from '../../datamodel';

export default function ObservationCreate() {
  const {project_id} = useParams<{
    project_id: ProjectID;
  }>();

  return (
    <Container maxWidth="lg">
      <Box display="flex" flexDirection="row-reverse" p={1} m={1}>
        <Breadcrumbs aria-label="breadcrumb">
          <NavLink to={ROUTES.INDEX}>Index</NavLink>
          <NavLink to={ROUTES.PROJECT_LIST}>Projects</NavLink>
          <NavLink to={ROUTES.PROJECT + project_id}>
            Project {project_id}
          </NavLink>
          <Typography color="textPrimary">New Observation</Typography>
        </Breadcrumbs>
      </Box>
      <Paper square>
        <b>Form generated from the project ui spec goes here</b>
      </Paper>
    </Container>
  );
}
