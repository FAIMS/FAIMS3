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
 * Filename: syncStatus.tsx
 * Description:
 *   This contains the syncStatus React component, which allows users to see their device's sync status
 */
import React, {useContext} from 'react';
import {Box, Grid} from '@mui/material';
import CloudIcon from '@mui/icons-material/Cloud';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
// import CloudDoneIcon from '@mui/icons-material/CloudDone';

import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ErrorIcon from '@mui/icons-material/Error';
import '../../../../node_modules/animate.css/animate.css';

import {store} from '../../../context/store';

export default function SyncStatus() {
  /**
   * sync_up(), sync_down() and sync_both()
   * States: isSyncingUp, isSyncingDown, isSynced
   * Icons:
   *    isSyncingUp true => CloudUploadIcon
   *    isSyncingDown true => isSyncingDown
   *    isSynced true => CloudDoneIcon
   *    isSynced false => ??
   *
   * Sync status depending on global state.
   * state.isSyncError =>  <CloudOffIcon />
   * state.isSyncingUp =>  <CloudIcon /> + <ArrowDropUpIcon/>
   * state.isSyncingDown =>  <CloudIcon /> + <ArrowDropDownIcon/>
   * state.hasUnsyncedChanges =>  <CloudQueueIcon /> <--- not currently in use
   *
   */

  const {state} = useContext(store);

  return (
    <React.Fragment>
      <Box
        sx={{
          justifyContent: 'center',
          position: 'relative',
          display: ' inline-flex',
          alignItems: 'center',
          verticalAlign: 'middle',
          mx: 2,
          width: '40px',
        }}
      >
        <Box display="flex" justifyContent="center" sx={{height: '100%'}}>
          {state.isSyncError ? (
            <React.Fragment>
              <CloudOffIcon style={{marginLeft: '11px'}} />
              <ErrorIcon
                style={{fontSize: '20px', marginTop: '-5px'}}
                color={'warning'}
              />
            </React.Fragment>
          ) : state.isSyncingUp || state.isSyncingDown ? (
            <CloudIcon />
          ) : (
            // state.hasUnsyncedChanges ? (<CloudQueueIcon />) : (<CloudDoneIcon />)
            <CloudQueueIcon />
          )}
        </Box>
        {!state.isSyncError ? (
          <Grid
            container
            style={{
              marginLeft: '-32px',
              maxHeight: '64px',
              marginBottom: '-3px',
            }}
            spacing={0}
          >
            <Grid item xs={12}>
              <Box display="flex" justifyContent="center">
                <ArrowDropUpIcon
                  sx={{fontSize: '32px'}}
                  color={!state.isSyncingUp ? 'disabled' : 'inherit'}
                  className={
                    state.isSyncingUp
                      ? 'animate__animated animate__flash animate__slow animate__infinite'
                      : ''
                  }
                />
              </Box>
            </Grid>
            <Grid item xs={12}>
              <Box display="flex" justifyContent="center">
                <ArrowDropDownIcon
                  sx={{fontSize: '32px'}}
                  color={!state.isSyncingDown ? 'disabled' : 'inherit'}
                  className={
                    state.isSyncingDown
                      ? 'animate__animated animate__flash animate__slow animate__infinite'
                      : ''
                  }
                />
              </Box>
            </Grid>
          </Grid>
        ) : (
          ''
        )}
      </Box>
    </React.Fragment>
  );
}
