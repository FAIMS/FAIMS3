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
import React, {useContext, useEffect, useRef} from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Paper,
  Popper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography,
} from '@mui/material';
import CloudIcon from '@mui/icons-material/Cloud';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
// import CloudDoneIcon from '@mui/icons-material/CloudDone';

import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ErrorIcon from '@mui/icons-material/Error';
import 'animate.css/animate.css';

import {store} from '../../../context/store';
import {grey} from '@mui/material/colors';
import moment from 'moment';
// custom hook for getting previous value
function usePrevious(value: any) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}
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
  const LAST_SYNC_FORMAT = 'MMMM Do YYYY, LTS';
  const [lastSync, setLastSync] = React.useState(
    moment().format(LAST_SYNC_FORMAT)
  );

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(anchorEl ? null : event.currentTarget);
  };

  const open = Boolean(anchorEl);
  const id = open ? 'simple-popper' : undefined;
  const prevSync = usePrevious({
    up: state.isSyncingUp,
    down: state.isSyncingDown,
  });

  useEffect(() => {
    setLastSync(moment().format(LAST_SYNC_FORMAT));
  }, [prevSync]);

  return (
    <React.Fragment>
      <Button
        aria-describedby={id}
        variant="text"
        type={'button'}
        onClick={handleClick}
        sx={{p: 0}}
      >
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
                <CloudOffIcon
                  style={{marginLeft: '11px'}}
                  sx={{color: 'primary'}}
                />
                <ErrorIcon
                  style={{fontSize: '20px', marginTop: '-5px'}}
                  color={'warning'}
                />
              </React.Fragment>
            ) : state.isSyncingUp || state.isSyncingDown ? (
              <CloudIcon sx={{color: 'primary'}} />
            ) : (
              // state.hasUnsyncedChanges ? (<CloudQueueIcon />) : (<CloudDoneIcon />)
              <CloudQueueIcon sx={{color: 'primary'}} />
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
                    color={!state.isSyncingUp ? 'disabled' : 'warning'}
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
                    color={!state.isSyncingDown ? 'disabled' : 'warning'}
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
      </Button>
      <Popper id={id} open={open} anchorEl={anchorEl}>
        <Card variant="outlined">
          <CardContent sx={{p: 0, paddingBottom: '0 !important'}}>
            <CardHeader
              title={'Sync Status'}
              sx={{textAlign: 'center', backgroundColor: grey[200], p: 1}}
            />
            <TableContainer component={Paper} elevation={0}>
              <Table
                sx={{maxWidth: 250, fontSize: 14, mb: 0}}
                aria-label="sync table"
                size={'small'}
              >
                <TableBody>
                  <TableRow>
                    <TableCell sx={{verticalAlign: 'top'}}>Status</TableCell>
                    <TableCell sx={{verticalAlign: 'top', textAlign: 'right'}}>
                      <Typography color="text.secondary" sx={{fontSize: 14}}>
                        {state.isSyncError
                          ? 'Error'
                          : state.isSyncingUp || state.isSyncingDown
                          ? 'In Progress'
                          : 'Idle'}
                      </Typography>
                      <Typography
                        color="text.secondary"
                        gutterBottom
                        variant={'caption'}
                      >
                        {state.isSyncError
                          ? 'Cannot sync to server, your device may be offline.'
                          : state.isSyncingUp || state.isSyncingDown
                          ? 'Sync is underway'
                          : 'Waiting for changes'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{verticalAlign: 'top'}}>Last Sync</TableCell>
                    <TableCell sx={{verticalAlign: 'top', textAlign: 'right'}}>
                      <Typography
                        color="text.secondary"
                        gutterBottom
                        sx={{fontSize: 14}}
                      >
                        {lastSync}
                      </Typography>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Popper>
    </React.Fragment>
  );
}
