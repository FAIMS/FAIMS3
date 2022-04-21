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
 * Filename: projectsetting attachment.tsx
 * Description:
 *   This file is for user to setup the syncing for attachment/photoes and download the attachement files and photoes
 * TODO:
 *   add the sync attahcment function and download files function
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
  Switch,
  FormControlLabel,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';

import Breadcrumbs from '../components/ui/breadcrumbs';
import * as ROUTES from '../../constants/routes';

import {getProjectInfo, listenProjectInfo} from '../../databaseAccess';
import {useEventedPromise, constantArgsShared} from '../pouchHook';
import {ProjectInformation} from '../../datamodel/ui';
import {dumpMetadataDBContents} from '../../uiSpecification';
import {ProjectID} from '../../datamodel/core';
import {TokenContents} from '../../datamodel/core';
import {useHistory} from 'react-router-dom';
type ProjectProps = {
  token?: null | undefined | TokenContents;
};

export default function PROJECTATTACHMENT(props: ProjectProps) {
  const {project_id} = useParams<{project_id: ProjectID}>();
  // TODO: check sync
  const [isSyncing, setIsSync] = useState(false);


  let project_info: ProjectInformation | null;
  const history = useHistory();

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
    {title: 'Attachment'},
  ];

  return project_info ? (
    <Container maxWidth="lg">
      <Breadcrumbs data={breadcrumbs} token={props.token} />

      <Box mb={2}>
        <Typography variant={'h2'} component={'h1'}>
          {project_info.name} Attachment Settings
        </Typography>
        <Typography variant={'subtitle1'} gutterBottom>
          Update the project Attachment settings for {project_info.name}.
        </Typography>
      </Box>
      <Paper square>
        <span>
          Attachment is auto Sync(Attachment and photoes will be auto downloaded
          if enabled)
        </span>
        <FormControlLabel
          control={
            <Switch
              checked={isSyncing}
              onChange={event => {
                setIsSync(!isSyncing);
                console.log(isSyncing);
              }}
            />
          }
          label={<Typography variant={'button'}>Sync</Typography>}
        />
        <br />
     
      </Paper>
      <Button color="primary" size="large" onClick={() => history.goBack()}>
        Go Back
      </Button>
    </Container>
  ) : (
    <CircularProgress />
  );
}
