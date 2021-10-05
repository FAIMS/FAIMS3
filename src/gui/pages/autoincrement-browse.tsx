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

import React, {useEffect} from 'react';
import {useParams} from 'react-router-dom';

import {
  Box,
  Container,
  Typography,
  Paper,
  CircularProgress,
} from '@material-ui/core';

import * as ROUTES from '../../constants/routes';
import {ProjectID} from '../../datamodel/core';
import {AutoIncrementReference} from '../../datamodel/database';
import {get_autoincrement_references_for_project} from '../../datamodel/autoincrement';
import {getProjectInfo, listenProjectInfo} from '../../databaseAccess';

import Breadcrumbs from '../components/ui/breadcrumbs';
import AutoIncrementConfigForm from '../components/autoincrement/browse-form';
import {constantArgsShared, useEventedPromiseCatchNow} from '../pouchHook';

export default function Record() {
  const {project_id} = useParams<{
    project_id: ProjectID;
  }>();

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
      title: project_info?.name ?? project_id,
    },
    {title: 'AutoIncrement Settings'},
  ];
  const [references, setReferences] = React.useState(
    [] as AutoIncrementReference[]
  );
  useEffect(() => {
    setReferences([]);
    get_autoincrement_references_for_project(project_id)
      .then(refs => {
        setReferences(refs);
      })
      .catch(console.error /*TODO*/);
  }, [project_id]);

  const autoincremeter_links =
    references.length > 0 ? (
      <div>
        {references.map(ref => {
          return <AutoIncrementConfigForm reference={ref} />;
        })}
      </div>
    ) : (
      <p>This project has no AutoIncrementers</p>
    );

  return (
    <Container maxWidth="lg">
      <Breadcrumbs data={breadcrumbs} />
      <Box mb={2}>
        <Typography variant={'h2'} component={'h1'}>
          Update AutoIncrement Settings
        </Typography>
        <Typography variant={'subtitle1'} gutterBottom>
          Update the settings for the AutoIncrementer for
          {project_info?.name ?? <CircularProgress />}.
        </Typography>
      </Box>
      <Paper square>{autoincremeter_links}</Paper>
    </Container>
  );
}
