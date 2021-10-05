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
 * Filename: autoincrement-browse.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import {useParams} from 'react-router-dom';

import {Box, Container, Typography, Paper} from '@material-ui/core';

import * as ROUTES from '../../constants/routes';
import {ProjectID} from '../../datamodel/core';
import {getProjectInfo, listenProjectInfo} from '../../databaseAccess';

import Breadcrumbs from '../components/ui/breadcrumbs';
import AutoIncrementEditForm from '../components/autoincrement/edit-form';
import {useEventedPromiseCatchNow, constantArgsShared} from '../pouchHook';

export default function AutoIncrementEdit() {
  const {project_id, form_id, field_id} = useParams<{
    project_id: ProjectID;
    form_id: string;
    field_id: string;
  }>();
  const name = `${form_id} (${field_id})`;
  const project_info = useEventedPromiseCatchNow(
    getProjectInfo,
    constantArgsShared(listenProjectInfo, project_id),
    false,
    [project_id],
    [project_id],
    [project_id]
  );

  const breadcrumbs = [
    {link: ROUTES.INDEX, title: 'Index'},
    {link: ROUTES.PROJECT_LIST, title: 'Projects'},
    {
      link: ROUTES.PROJECT + project_id,
      title: project_info !== null ? project_info.name : project_id,
    },
    {
      link: ROUTES.PROJECT + project_id + ROUTES.AUTOINCREMENT_LIST,
      title: 'AutoIncrement Settings',
    },
    {
      title: name,
    },
  ];

  return (
    <Container maxWidth="lg">
      <Breadcrumbs data={breadcrumbs} />
      <Box mb={2}>
        <Typography variant={'h2'} component={'h1'}>
          Update AutoIncrement Settings
        </Typography>
        <Typography variant={'subtitle1'} gutterBottom>
          Update the settings for the AutoIncrementer for {name}.
        </Typography>
      </Box>
      <Paper square>
        <AutoIncrementEditForm
          project_id={project_id}
          form_id={form_id}
          field_id={field_id}
        />
      </Paper>
    </Container>
  );
}
