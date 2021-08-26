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
 * Filename: record-create.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import {Box, Container, Typography, Paper} from '@material-ui/core';
import {useParams} from 'react-router-dom';
import * as ROUTES from '../../constants/routes';
import Breadcrumbs from '../components/ui/breadcrumbs';
import {generateFAIMSDataID} from '../../data_storage';
import RecordForm from '../components/record/form';
import {getProjectInfo} from '../../databaseAccess';
import {ProjectID} from '../../datamodel/core';

export default function RecordCreate() {
  const {project_id} = useParams<{
    project_id: ProjectID;
  }>();
  const project_info = getProjectInfo(project_id);
  const breadcrumbs = [
    {link: ROUTES.INDEX, title: 'Index'},
    {link: ROUTES.PROJECT_LIST, title: 'Projects'},
    {
      link: ROUTES.PROJECT + project_id,
      title: project_info !== null ? project_info.name : project_id,
    },
    {title: 'New Record'},
  ];
  return (
    <Container maxWidth="lg">
      <Breadcrumbs data={breadcrumbs} />
      <Box mb={2}>
        <Typography variant={'h2'} component={'h1'}>
          Record Record
        </Typography>
        <Typography variant={'subtitle1'} gutterBottom>
          Add an record for the{' '}
          {project_info !== null ? project_info.name : project_id} project.
        </Typography>
      </Box>
      <Paper square>
        <Box p={3}>
          <RecordForm
            project_id={project_id}
            record_id={generateFAIMSDataID()}
            revision_id={null}
          />
        </Box>
      </Paper>
    </Container>
  );
}
