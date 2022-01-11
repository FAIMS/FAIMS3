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

import React, {useEffect, useState} from 'react';
import {useParams, Redirect, Link as RouterLink} from 'react-router-dom';

import {
  Box,
  Button,
  Container,
  Typography,
  Paper,
  CircularProgress,
  TextareaAutosize,
} from '@material-ui/core';
import EditIcon from '@material-ui/icons/Edit';

import Breadcrumbs from '../components/ui/breadcrumbs';
import * as ROUTES from '../../constants/routes';

import {getProjectInfo, listenProjectInfo} from '../../databaseAccess';
import {useEventedPromise, constantArgsShared} from '../pouchHook';
import {ProjectInformation} from '../../datamodel/ui';
import {dumpMetadataDBContents} from '../../uiSpecification';
import {ProjectID} from '../../datamodel/core';

export default function ProjectSettings() {
  const {project_id} = useParams<{project_id: ProjectID}>();

  // TODO: remove these once we can send new project up
  const [loading, setLoading] = useState(true);
  const [metadbContents, setMetadbContents] = useState<object[]>([]);

  let project_info: ProjectInformation | null;
  try {
    project_info = useEventedPromise(
      getProjectInfo,
      constantArgsShared(listenProjectInfo, project_id),
      false,
      [project_id],
      project_id
    ).expect();
  } catch (err: any) {
    if (err.message === 'missing') {
      return <Redirect to="/404" />;
    } else {
      throw err;
    }
  }

  const breadcrumbs = [
    {link: ROUTES.HOME, title: 'Home'},
    {link: ROUTES.PROJECT_LIST, title: 'Notebook'},
    {
      link: ROUTES.PROJECT + project_id,
      title: project_info !== null ? project_info.name : '[loading]',
    },
    {title: 'Settings'},
  ];

  useEffect(() => {
    if (project_id === null) return;
    const getDB = async () => {
      setMetadbContents(await dumpMetadataDBContents(project_id));
      setLoading(false);
    };
    getDB();
  }, []);

  console.debug('MetaDB contents', metadbContents);

  return project_info ? (
    <Container maxWidth="lg">
      <Breadcrumbs data={breadcrumbs} />

      <Box mb={2}>
        <Typography variant={'h2'} component={'h1'}>
          {project_info.name} Settings
        </Typography>
        <Typography variant={'subtitle1'} gutterBottom>
          Update the project settings for
          {project_info.name}.
        </Typography>
      </Box>
      <Paper square>
        <Button
          color="primary"
          size="large"
          startIcon={<EditIcon />}
          component={RouterLink}
          to={ROUTES.PROJECT_DESIGN + project_id}
        >
          Edit Notebook Design
        </Button>
        <br />
        <Button
          color="primary"
          size="large"
          component={RouterLink}
          startIcon={<EditIcon />}
          to={ROUTES.PROJECT + project_id + ROUTES.AUTOINCREMENT_LIST}
        >
          Edit AutoIncrement Allocations
        </Button>
      </Paper>
      <Box mb={1}>
        <Typography variant={'subtitle1'}>
          The metadata database contents of
          {project_info !== null ? project_info.name : project_id}.
        </Typography>
        {loading ? (
          'Loading...'
        ) : (
          <TextareaAutosize
            defaultValue={JSON.stringify(metadbContents)}
            disabled={true}
          />
        )}
      </Box>
    </Container>
  ) : (
    <CircularProgress />
  );
}
