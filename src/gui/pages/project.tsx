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

import React from 'react';
import {useParams, Redirect} from 'react-router-dom';
import {Container} from '@mui/material';
import Breadcrumbs from '../components/ui/breadcrumbs';
import ProjectCard from '../components/project/card';
import * as ROUTES from '../../constants/routes';

import {getProjectInfo, listenProjectInfo} from '../../databaseAccess';
import {ProjectID} from '../../datamodel/core';
import {useEventedPromise, constantArgsShared} from '../pouchHook';
import {CircularProgress} from '@mui/material';
import {ProjectInformation} from '../../datamodel/ui';
import makeStyles from '@mui/styles/makeStyles';
import {TokenContents} from '../../datamodel/core';

const useStyles = makeStyles(theme => ({
  NoPadding: {
    [theme.breakpoints.down('md')]: {
      paddingLeft: 5,
      paddingRight: 5,
    },
  },
}));

type ProjectProps = {
  token?: null | undefined | TokenContents;
};

export default function Project(props: ProjectProps) {
  const {project_id} = useParams<{project_id: ProjectID}>();
  let project_info: ProjectInformation | null;
  const classes = useStyles();
  try {
    project_info = useEventedPromise(
      getProjectInfo,
      constantArgsShared(listenProjectInfo, project_id),
      false,
      [project_id],
      project_id
    ).expect();
  } catch (err: any) {
    if (err.message !== 'missing') {
      throw err;
    } else {
      return <Redirect to="/404" />;
    }
  }

  const breadcrumbs = [
    {link: ROUTES.HOME, title: 'Home'},
    {link: ROUTES.PROJECT_LIST, title: 'Notebooks'},
    {title: project_info !== null ? project_info.name : ''},
  ];

  return project_info ? (
    <Container maxWidth="lg" className={classes.NoPadding}>
      <Breadcrumbs data={breadcrumbs} token={props.token} />
      <ProjectCard project={project_info} showRecords={true} listView={false} />
    </Container>
  ) : (
    <CircularProgress />
  );
}