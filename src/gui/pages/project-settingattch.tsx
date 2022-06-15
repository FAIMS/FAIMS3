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
 *   This file is for user to set up the syncing for attachment/photos and
 *   download the attachment files and photos
 * TODO:
 *   add the sync attachment function and download files function
 */

import React, {useEffect, useState, useContext} from 'react';
import {useParams, Redirect, useHistory} from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Typography,
  Paper,
  CircularProgress,
  Switch,
  FormControlLabel,
} from '@mui/material';

import Breadcrumbs from '../components/ui/breadcrumbs';
import * as ROUTES from '../../constants/routes';

import {getProjectInfo, listenProjectInfo} from '../../databaseAccess';
import {useEventedPromise, constantArgsShared} from '../pouchHook';
import {ProjectInformation} from '../../datamodel/ui';
import {ProjectID, TokenContents} from '../../datamodel/core';
import {
  isSyncingProjectAttachments,
  setSyncingProjectAttachments,
  listenSyncingProjectAttachments,
} from '../../sync/sync-toggle';
import {store} from '../../store';
import {ActionType} from '../../actions';
type ProjectProps = {
  token?: null | undefined | TokenContents;
};

export default function PROJECTATTACHMENT(props: ProjectProps) {
  const {project_id} = useParams<{project_id: ProjectID}>();
  const [isSyncing, setIsSyncing] = useState<null | boolean>(null);
  const {dispatch} = useContext(store);

  useEffect(() => {
    try {
      if (project_id !== null)
        setIsSyncing(isSyncingProjectAttachments(project_id));
    } catch (err: any) {
      console.error('error to get sync');
    }

    return listenSyncingProjectAttachments(project_id, setIsSyncing);
  }, [project_id]);

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
  console.log(isSyncing);
  if (isSyncing === null) return <></>;
  return project_info ? (
    <Container maxWidth="lg">
      <Breadcrumbs data={breadcrumbs} token={props.token} />

      <Box mb={2}>
        <Typography variant={'h2'} component={'h1'}>
          SHOW/DOWNLOAD EXTERNAL ATTACHMENTS
        </Typography>
        <Typography variant={'subtitle1'} gutterBottom>
          Configure external attachments for {project_info.name}
        </Typography>
        <Typography variant={'subtitle1'} gutterBottom>
          <br />
        </Typography>
      </Box>
      <Paper square>
        <Typography style={{padding: '15px 15px'}}>
          This control is notebook specific. If ‘Download and show other
          devices' images and attachments’ is turned on, FAIMS will
          automatically show images and attachments for the notebook. This
          setting does not affect uploads. Attachments are always uploaded to
          the server regardless of the setting
        </Typography>
        <Typography variant={'body1'} style={{marginLeft: '1em'}}>
          {'      '}
          <FormControlLabel
            control={
              <Switch
                checked={isSyncing}
                onChange={async (event, checked) => {
                  await setSyncingProjectAttachments(project_id, checked);
                  if (checked)
                    dispatch({
                      type: ActionType.ADD_ALERT,
                      payload: {
                        message: 'Start downlading',
                        severity: 'success',
                      },
                    });
                }}
              />
            }
            label={
              <Typography variant={'button'}>
                Download and show other devices' external images and attachments
              </Typography>
            }
          />
          <br />
        </Typography>
      </Paper>
      <br />
      <Button color="primary" size="large" onClick={() => history.goBack()}>
        Go Back
      </Button>
    </Container>
  ) : (
    <CircularProgress />
  );
}
