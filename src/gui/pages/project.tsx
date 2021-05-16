import React, {useContext} from 'react';
import {NavLink, useParams} from 'react-router-dom';
import {Box, Breadcrumbs, Container, Typography} from '@material-ui/core';
import ProjectCard from '../components/projectCard';
import * as ROUTES from '../../constants/routes';

import {store} from '../../store';

export default function Project() {
  const {project_id} = useParams<{project_id: string}>();
  const globalState = useContext(store);

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
      {JSON.stringify(globalState)}
      {/*<ProjectCard project={project}/>*/}
    </Container>
  );
}
