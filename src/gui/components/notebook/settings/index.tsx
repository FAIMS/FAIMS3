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
  Alert,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';

import * as ROUTES from '../../../../constants/routes';

import {getProjectInfo, listenProjectInfo} from '../../../../databaseAccess';
import {
  useEventedPromise,
  constantArgsShared,
  constantArgsSplit,
} from '../../../pouchHook';
import {ProjectInformation} from '../../../../datamodel/ui';
import {dumpMetadataDBContents} from '../../../../uiSpecification';
import {ProjectID, split_full_project_id} from '../../../../datamodel/core';
import MetaDataJsonComponentProps from './metadata_json';
import {
  isSyncingProjectAttachments,
  listenSyncingProjectAttachments,
  setSyncingProjectAttachments,
} from '../../../../sync/sync-toggle';
import {ActionType} from '../../../../context/actions';
import {store} from '../../../../context/store';
import AutoIncrementerSettingsList from './auto_incrementers';
import {
  getUserProjectRolesForCluster,
  isClusterAdmin,
  ADMIN_ROLE,
} from '../../../../users';
import {listenDataDB} from '../../../../sync';
import CircularLoading from '../../ui/circular_loading';
import ProjectStatus from './status';
import NotebookSyncSwitch from './sync_switch';
import {ProjectUIModel} from '../../../../datamodel/ui';

export default function NotebookSettings(props: {uiSpec: ProjectUIModel}) {
  const {project_id} = useParams<{project_id: ProjectID}>();

  const [isSyncing, setIsSyncing] = useState<null | boolean>(null);
  const {dispatch} = useContext(store);

  // TODO: remove these once we can send new project up
  const [loading, setLoading] = useState(true);
  const [metadbContents, setMetadbContents] = useState<object[]>([]);

  // What rights does the user have on this notebook?
  const role_info = useEventedPromise(
    'NotebookSettings component',
    async (project_id: ProjectID) => {
      const split_id = await split_full_project_id(project_id);
      const roles = await getUserProjectRolesForCluster(split_id.listing_id);
      const is_admin = await isClusterAdmin(split_id.listing_id);

      let can_edit_notebook_on_server = false;
      const can_edit_notebook_on_device = false;
      for (const role in roles) {
        if (role === split_id.project_id && roles[role].includes(ADMIN_ROLE)) {
          can_edit_notebook_on_server = true;
        }
      }
      return {
        can_edit_notebook_on_device: can_edit_notebook_on_device,
        can_edit_notebook_on_server: can_edit_notebook_on_server,
        is_admin: is_admin,
        roles: roles,
      };
    },
    constantArgsSplit(
      listenDataDB,
      [project_id, {since: 'now', live: true}],
      [project_id]
    ),
    false,
    [project_id],
    project_id
  );

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
      'NotebookSettings component project info',
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
      <Grid
        container
        rowSpacing={{xs: 1, sm: 2, md: 3}}
        columnSpacing={{xs: 1, sm: 2, md: 3}}
        sx={{mb: {xs: 1, sm: 2, md: 3}}}
      >
        <Grid item xs={12} sm={12} md={6} lg={4}>
          <Box
            component={Paper}
            variant={'outlined'}
            elevation={0}
            p={2}
            mb={{xs: 1, sm: 2, md: 3}}
          >
            <Typography variant={'h6'} sx={{mb: 2}}>
              Notebook Status
            </Typography>
            <Grid container spacing={1}>
              <Grid item xs={12}>
                <Box>
                  <ProjectStatus status={project_info.status} />
                </Box>
              </Grid>
              {role_info.value?.can_edit_notebook_on_device ||
              role_info.value?.can_edit_notebook_on_server ||
              String(process.env.REACT_APP_SERVER) === 'developers' ? (
                <Grid item xs={12}>
                  <Button
                    color="primary"
                    variant={'outlined'}
                    startIcon={<EditIcon />}
                    component={RouterLink}
                    to={ROUTES.PROJECT_DESIGN + project_id}
                  >
                    Edit Notebook Design
                  </Button>
                </Grid>
              ) : (
                ''
              )}
              {role_info.value?.can_edit_notebook_on_device ? (
                <Grid item xs={12}>
                  <Alert severity={'info'}>
                    You may edit the notebook, but your changes will only be
                    saved locally to your device. Contact the FAIMS team to
                    publish your notebook.
                  </Alert>
                </Grid>
              ) : (
                ''
              )}
              {role_info.value?.can_edit_notebook_on_device ||
              role_info.value?.can_edit_notebook_on_server ? (
                <Grid item xs={12}>
                  <Alert severity={'warning'}>
                    If this notebook already has records saved, editing the
                    notebook may cause issues. Proceed with caution.
                  </Alert>
                </Grid>
              ) : (
                ''
              )}
            </Grid>
          </Box>

          <Box
            component={Paper}
            variant={'outlined'}
            elevation={0}
            p={2}
            mb={{xs: 1, sm: 2, md: 3}}
          >
            <Typography variant={'h6'} sx={{mb: 2}}>
              Sync Notebook
            </Typography>
            <NotebookSyncSwitch
              project={project_info}
              showHelperText={true}
              project_status={project_info?.status}
            />
          </Box>

          <Box component={Paper} variant={'outlined'} elevation={0} p={2}>
            <Typography variant={'h6'} sx={{mb: 2}}>
              Get attachments from other devices
            </Typography>
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
            <CircularLoading label={'Loading autoincrementer information...'} />
          </Grid>
        ) : (
          <Grid item xs={12} sm={12} md={6} lg={8}>
            <AutoIncrementerSettingsList
              project_info={project_info}
              uiSpec={props.uiSpec}
            />
          </Grid>
        )}
      </Grid>
      <Grid
        container
        rowSpacing={{xs: 1, sm: 2, md: 3}}
        columnSpacing={{xs: 1, sm: 2, md: 3}}
      >
        <Grid item xs={12} sm={12} md={8}>
          <Box component={Paper} variant={'outlined'} elevation={0} p={2}>
            <Typography variant={'h6'} sx={{mb: 2}}>
              Metadata DB contents
            </Typography>
            {loading ? (
              <CircularLoading label={'Loading...'} />
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
