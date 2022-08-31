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
import {useParams, Redirect, Link as RouterLink} from 'react-router-dom';
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
import {ProjectID} from '../../datamodel/core';
import {
  isSyncingProjectAttachments,
  setSyncingProjectAttachments,
  listenSyncingProjectAttachments,
} from '../../sync/sync-toggle';
import {store} from '../../store';
import {ActionType} from '../../actions';

export default function PROJECTATTACHMENT() {
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
    {link: ROUTES.INDEX, title: 'Home'},
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
      <Breadcrumbs data={breadcrumbs} />

      <Box mb={2}>
        <Typography variant={'h2'} component={'h1'}>
          Get attachments from other devices
        </Typography>
        <Typography variant={'subtitle1'} gutterBottom>
          Configure download of attachments from central server for this
          notebook ( {project_info.name} )
        </Typography>
        <Typography variant={'subtitle1'} gutterBottom>
          <br />
        </Typography>
      </Box>
      <Paper square>
        <Typography style={{padding: '15px 15px'}}>
          This control is notebook and device specific. If this option is
          enabled, FAIMS will automatically download and show images and
          attachments created by other devices. Be aware that this may be
          resource intensive and use your mobile data plan. Disable this setting
          to minimise network usage. This setting will not affect uploading of
          your data from this device to the central server. Attachments are
          always uploaded to the server regardless of this setting.
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
                        message: 'Start downloading',
                        severity: 'success',
                      },
                    });
                }}
              />
            }
            label={
              <Typography variant={'button'}>
                Get attachments from other devices
              </Typography>
            }
          />
          <br />
        </Typography>
      </Paper>
      <br />
      <Button
        color="primary"
        size="large"
        component={RouterLink}
        to={ROUTES.PROJECT + project_id}
      >
        Go Back to Notebook
      </Button>
    </Container>
  ) : (
    <CircularProgress />
  );
}
