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


import React, { useState,useEffect} from 'react';
import {useParams, Redirect} from 'react-router-dom';
import Breadcrumbs from '../components/ui/breadcrumbs';
import CreateProjectCard from '../components/project/CreateProjectCard';
import * as ROUTES from '../../constants/routes';

import {Typography,Container,Paper,Box} from '@material-ui/core';

import {ProjectID} from '../../datamodel/core';
import {getProjectInfo} from '../../databaseAccess';
import {getUiSpecForProject} from '../../uiSpecification';
import {ProjectUIModel} from '../../datamodel/ui';

export default function ProjectCreate() {
  const {project_id} = useParams<{project_id: ProjectID}>();
  // if(typeof project_id!=='undefined') {
  const project_info = getProjectInfo(project_id);
  const [uiSpec, setUISpec] = useState(null as null | ProjectUIModel);
  const [error, setError] = useState(null as null | {});
  // }
  const breadcrumbs = [
    {link: ROUTES.INDEX, title: 'Index'},
    {title: project_info !== null ? project_info.name : 'Create New Notebook'},
  ];
  
  useEffect(() => {
    getUiSpecForProject(project_id).then(setUISpec, setError);
    console.log(project_id+uiSpec)
    
  }, [project_id]);

console.log(project_info)
   return  (
    <Container maxWidth="lg">
      <Breadcrumbs data={breadcrumbs} />
      <Box mb={2}>
        <Typography variant={'h2'} component={'h1'}>
          {project_info !== null ? 'Edit Notebook' : 'Create Notebook'}
        </Typography>
        <Typography variant={'subtitle1'} gutterBottom>
        {project_info !== null ? 'Design and preview your notebook' : 'Design and preview your new notebook before inviting team members and publising'}
        </Typography>
      </Box>
      <Paper square>
        <CreateProjectCard project_id={project_id} uiSpec={uiSpec}/>
      </Paper>
    </Container>
  );
  
}
