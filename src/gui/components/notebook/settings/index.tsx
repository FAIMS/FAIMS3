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
 * Filename: settings.tsx
 * Description:
 *   TODO
 */

import React, {useContext, useEffect, useState} from 'react';
import {useParams, Redirect, Link as RouterLink} from 'react-router-dom';

import {
  Box,
  Button,
  Typography,
  Grid,
  Paper,
  CircularProgress,
  FormControlLabel,
  Switch,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

import * as ROUTES from '../../../../constants/routes';

import {getProjectInfo, listenProjectInfo} from '../../../../databaseAccess';
import {useEventedPromise, constantArgsShared} from '../../../pouchHook';
import {ProjectInformation} from '../../../../datamodel/ui';
import {dumpMetadataDBContents} from '../../../../uiSpecification';
import {ProjectID} from '../../../../datamodel/core';
import MetaDataJsonComponentProps from './metadata_json';
import {
  isSyncingProjectAttachments,
  listenSyncingProjectAttachments,
  setSyncingProjectAttachments,
} from '../../../../sync/sync-toggle';
import {ActionType} from '../../../../context/actions';
import {store} from '../../../../context/store';
import AutoIncrementerSettingsList from './auto_incrementers';

export default function NotebookSettings() {
  const {project_id} = useParams<{project_id: ProjectID}>();

  const [isSyncing, setIsSyncing] = useState<null | boolean>(null);
  const {dispatch} = useContext(store);

  // TODO: remove these once we can send new project up
  const [loading, setLoading] = useState(true);
  const [metadbContents, setMetadbContents] = useState<object[]>([]);

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

  useEffect(() => {
    if (project_id === null) return;
    const getDB = async () => {
      setMetadbContents(await dumpMetadataDBContents(project_id));
      setLoading(false);
    };
    getDB();
  }, []);

  return project_info ? (
    <Box>
      <Grid container spacing={{xs: 1, sm: 2, md: 3}}>
        <Grid item xs={12} sm={12} md={6} lg={4}>
          <Typography variant={'overline'}>Notebook Status</Typography>
          <Box
            component={Paper}
            variant={'outlined'}
            elevation={0}
            p={2}
            mb={2}
          >
            <Grid
              container
              direction="row"
              justifyContent="flex-start"
              alignItems="center"
              spacing={2}
            >
              <Grid item xs={6}>
                <Box sx={{p: 1, display: 'flex'}}>
                  <FiberManualRecordIcon
                    fontSize="small"
                    sx={{
                      mr: 1,
                      color:
                        project_info.status === 'live' ? '#4caf50' : '#d9182e',
                    }}
                  />
                  {project_info.status}
                </Box>
              </Grid>
              <Grid item xs={6}>
                {project_info.status !== 'live' && (
                  <Button
                    color="primary"
                    variant={'outlined'}
                    startIcon={<EditIcon />}
                    component={RouterLink}
                    to={ROUTES.PROJECT_DESIGN + project_id}
                    style={{float: 'right'}}
                  >
                    Edit Notebook Design
                  </Button>
                )}
              </Grid>
            </Grid>
          </Box>

          <Typography variant={'overline'}>
            Get attachments from other devices
          </Typography>
          <Box
            component={Paper}
            variant={'outlined'}
            elevation={0}
            p={2}
            mb={2}
          >
            {isSyncing !== null ? (
              <Box>
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
                              message: 'Downloading attachments to device...',
                              severity: 'success',
                            },
                          });
                      }}
                    />
                  }
                  label={<Typography>{isSyncing ? 'On' : 'Off'}</Typography>}
                />
                <Typography variant={'body2'}>
                  This control is notebook and device specific. If this option
                  is enabled, FAIMS will automatically download and show images
                  and attachments created by other devices. Be aware that this
                  may be resource intensive and use your mobile data plan.
                  Disable this setting to minimise network usage. This setting
                  will not affect uploading of your data from this device to the
                  central server. Attachments are always uploaded to the server
                  regardless of this setting.
                </Typography>
              </Box>
            ) : (
              ''
            )}
          </Box>
        </Grid>
        {loading ? (
          <Grid item>
            <CircularProgress size={'small'} /> Loading AutoIncrementer info
          </Grid>
        ) : (
          <Grid item xs={12} sm={12} md={6} lg={8}>
            <AutoIncrementerSettingsList project_info={project_info} />
          </Grid>
        )}
      </Grid>
      <Grid container>
        <Grid item xs={12} sm={12} md={8}>
          <Typography variant={'overline'}>Metadata DB contents</Typography>
          <Box mb={1} component={Paper} variant={'outlined'} elevation={0}>
            {loading ? (
              'Loading...'
            ) : (
              <MetaDataJsonComponentProps value={metadbContents} />
            )}
          </Box>
        </Grid>
      </Grid>
    </Box>
  ) : (
    <CircularProgress />
  );
}
