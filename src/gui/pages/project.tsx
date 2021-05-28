/*
 * Copyright 2021 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: project.tsx
 * Description: 
 *   TODO
 */
 
import React from 'react';
import {useParams, Redirect, Link as RouterLink} from 'react-router-dom';
import {Box, Breadcrumbs, Container, Link, Typography} from '@material-ui/core';
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
      />
    </Container>
  ) : (
    <Redirect to="/404" />
  );
}
