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
 * Filename: project-create.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import {useParams, Redirect} from 'react-router-dom';
import Breadcrumbs from '../components/ui/breadcrumbs';
import CreateProjectCard from '../components/project/CreateProjectCard';
import * as ROUTES from '../../constants/routes';

import {Typography,Container,Paper,Box} from '@material-ui/core';

export default function ProjectCreate() {

  const breadcrumbs = [
    {link: ROUTES.INDEX, title: 'Index'},
    {link: ROUTES.PROJECT_LIST, title: 'Projects'},
    {title: 'Create New Notebook'},
  ];
   return  (
    <Container maxWidth="lg">
      <Breadcrumbs data={breadcrumbs} />
      <Box mb={2}>
        <Typography variant={'h2'} component={'h1'}>
          Create Notebook
        </Typography>
        <Typography variant={'subtitle1'} gutterBottom>
          Design and preview your new notebook before inviting team members and publising
        </Typography>
      </Box>
      <Paper square>
        <CreateProjectCard />
      </Paper>
    </Container>
  );
  
}
