import React from 'react';
import {useParams, Redirect, Link as RouterLink} from 'react-router-dom';
import {Box, Breadcrumbs, Container, Link, Typography} from '@material-ui/core';
import ProjectCard from '../components/projectCard';
import * as ROUTES from '../../constants/routes';

import {getProjectInfo} from '../../databaseAccess';

export default function Project() {
  const {listing_id_project_id} = useParams<{listing_id_project_id: string}>();
  const project_info = getProjectInfo(listing_id_project_id);

  return project_info ? (
    <Container maxWidth="lg">
      <Box display="flex" flexDirection="row-reverse" p={1} m={1}>
        <Breadcrumbs aria-label="breadcrumb">
          <Link component={RouterLink} to={ROUTES.INDEX}>
            Index
          </Link>
          <Link component={RouterLink} to={ROUTES.PROJECT_LIST}>
            Projects
          </Link>
          <Typography color="textPrimary">{project_info.name}</Typography>
        </Breadcrumbs>
      </Box>
      <ProjectCard
        project={project_info}
        showObservations={true}
        listView={false}
        listing_id_project_id={listing_id_project_id}
      />
    </Container>
  ) : (
    <Redirect to="/404" />
  );
}
