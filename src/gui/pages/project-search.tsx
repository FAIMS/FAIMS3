/*
 * Copyright 2021, 2022 Macquarie University
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

import React, {useState, useEffect} from 'react';
import {useParams, Redirect} from 'react-router-dom';
import {Container, Typography} from '@material-ui/core';
import Breadcrumbs from '../components/ui/breadcrumbs';
import {ProjectSearchCard} from '../components/project/card';
import * as ROUTES from '../../constants/routes';

import {getProjectInfo} from '../../databaseAccess';
import {ProjectID} from '../../datamodel/core';
import {ProjectInformation} from '../../datamodel/ui';
import {makeStyles} from '@material-ui/core/styles';

const useStyles = makeStyles(theme => ({
  NoPaddding: {
    [theme.breakpoints.down('sm')]: {
      paddingLeft: 0,
      paddingRight: 0,
    },
  },
}));
export default function ProjectSearch() {
  const {project_id} = useParams<{project_id: ProjectID}>();
  const [project_info, set_project_info] = useState(
    null as null | ProjectInformation
  );
  const classes = useStyles();
  useEffect(() => {
    set_project_info(null);
    if (project_id !== undefined) {
      //only get UISpec when project is defined
      getProjectInfo(project_id).then(set_project_info).catch(console.error);
    }
  }, [project_id]);

  if (project_info === null) {
    return (
      <Container maxWidth="lg">
        <Typography>{'Getting ready to search project...'}</Typography>
      </Container>
    );
  }

  const breadcrumbs = [
    {link: ROUTES.HOME, title: 'Home'},
    {link: ROUTES.PROJECT_LIST, title: 'Notebook'},
    {title: project_info !== null ? project_info.name : ''},
  ];
  return project_info ? (
    <Container maxWidth="lg" className={classes.NoPaddding}>
      <Breadcrumbs data={breadcrumbs} />
      <ProjectSearchCard project={project_info} />
    </Container>
  ) : (
    <Redirect to="/404" />
  );
}
