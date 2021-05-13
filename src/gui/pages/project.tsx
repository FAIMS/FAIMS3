import React from 'react';
import {NavLink, useParams} from 'react-router-dom';
import {Box, Breadcrumbs, Container, Typography} from '@material-ui/core';
import * as ROUTES from '../../constants/routes';

export default function Project() {
  const {project_id} = useParams<{project_id: string}>();
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
    </Container>
  );
}
