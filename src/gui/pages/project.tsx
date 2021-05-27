import React from 'react';
import {NavLink, useParams, Redirect} from 'react-router-dom';
import {Box, Breadcrumbs, Container, Typography} from '@material-ui/core';
import ProjectCard from '../components/projectCard';
import * as ROUTES from '../../constants/routes';

import {getProjectInfo} from '../../databaseAccess';
import {ProjectID} from '../../datamodel';

export default function Project() {
  const {project_id} = useParams<{project_id: ProjectID}>();
  const project_info = getProjectInfo(project_id);

  return project_info ? (
    <Container maxWidth="lg">
      <Box display="flex" flexDirection="row-reverse" p={1} m={1}>
        <Breadcrumbs aria-label="breadcrumb">
          <NavLink to={ROUTES.INDEX}>Index</NavLink>
          <NavLink to={ROUTES.PROJECT_LIST}>Projects</NavLink>
          <Typography color="textPrimary">{project_info.name}</Typography>
        </Breadcrumbs>
      </Box>
      <ProjectCard
        project={project_info}
        showObservations={true}
        listView={false}
      />
    </Container>
  ) : (
    <Redirect to="/404" />
  );
}
