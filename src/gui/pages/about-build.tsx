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
 * Filename: about-build.tsx
 * Description:
 *   TODO
 */

import React, {useEffect, useRef} from 'react';
import {
  Box,
  Paper,
  Divider,
  Button,
  Typography,
  Grid,
  Alert,
  AlertTitle,
  LinearProgress,
  AppBar,
  Toolbar,
} from '@mui/material';
import {grey} from '@mui/material/colors';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';
import ShareIcon from '@mui/icons-material/Share';
import StorageIcon from '@mui/icons-material/Storage';
import * as ROUTES from '../../constants/routes';
import {unregister as unregisterServiceWorker} from '../../serviceWorkerRegistration';
import {progressiveSaveFiles} from '../../sync/data-dump';
import {
  DIRECTORY_HOST,
  RUNNING_UNDER_TEST,
  COMMIT_VERSION,
  SHOW_MINIFAUXTON,
  SHOW_WIPE,
} from '../../buildconfig';
import Breadcrumbs from '../components/ui/breadcrumbs';
import {wipe_all_pouch_databases} from '../../sync/databases';
import BoxTab from '../components/ui/boxTab';
import DialogActions from '@mui/material/DialogActions';
import Dialog from '@mui/material/Dialog';

export default function AboutBuild() {
  const breadcrumbs = [
    {link: ROUTES.INDEX, title: 'Home'},
    {title: 'about-build'},
  ];

  const [wipeDialogOpen, setWipeDialogOpen] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [showingProgress, setShowingProgress] = React.useState(false);
  const [progressiveDump, setProgressiveDump] = React.useState(false);
  const [progressMessage, setProgressMessage] = React.useState('');

  // need useRef here because this value is used in a callback which
  // needs to see the live value so that when we cancel, it can
  // pass back to the caller.  Just using `progressiveDump` here
  // doesn't work as it freezes the value from the time of the initial
  // call to `progressiveSaveFiles`
  const keepDumping = useRef(false);

  // update progress and return true if the dump should continue
  const handleProgress = (progress: number): boolean => {
    setProgress(progress);
    if (progress < 0) {
      keepDumping.current = false;
      setProgressMessage('Share is not available on this device/browser');
      setProgressiveDump(false);
    }
    if (progress > 100) {
      setProgressMessage('Share is complete');
      setShowingProgress(false);
    }
    return keepDumping.current;
  };

  useEffect(() => {
    if (progressiveDump) {
      keepDumping.current = true;
      progressiveSaveFiles(handleProgress);
    } else {
      keepDumping.current = false;
    }
  }, [progressiveDump]);

  const handleShareDump = async () => {
    setShowingProgress(true);
    setProgressiveDump(true);
  };

  const handleCancelDump = () => {
    setProgressiveDump(false);
    setShowingProgress(false);
  };

  return (
    <Box sx={{p: 2}}>
      <Breadcrumbs data={breadcrumbs} />
      <BoxTab title={'Fieldmark Configuration'} bgcolor={grey[100]} />
      <Box bgcolor={grey[100]} p={2} style={{overflowX: 'scroll'}} mb={2}>
        <pre>
          <table>
            <tbody>
              <tr>
                <td>Directory Server:</td>
                <td>{DIRECTORY_HOST}</td>
              </tr>
              <tr>
                <td>Version:</td>
                <td>{COMMIT_VERSION}</td>
              </tr>
              <tr>
                <td>{RUNNING_UNDER_TEST ? 'Running under test' : ''}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </pre>
      </Box>
      <Box
        component={Paper}
        sx={{p: 2, my: {xs: 1, sm: 2}}}
        elevation={0}
        variant={'outlined'}
      >
        <Grid
          container
          direction="row"
          justifyContent="flex-start"
          alignItems="left"
          spacing={2}
        >
          <Grid item md={4} sm={6} xs={12}>
            <Typography variant={'h5'} gutterBottom>
              Having issues?
            </Typography>

            <Typography variant={'body2'}>
              Refresh the app (this is similar to a browser refresh)
            </Typography>
          </Grid>
          <Grid item md={8} sm={6} xs={12}>
            <Button
              variant="contained"
              color={'primary'}
              size={'small'}
              disableElevation
              onClick={() => {
                console.log('User refreshed page');
                unregisterServiceWorker();
                window.location.reload();
              }}
              startIcon={<RefreshIcon />}
            >
              Refresh the app
            </Button>
          </Grid>
          <Grid item xs={12}>
            <Divider />
          </Grid>
          <Grid item md={4} sm={6} xs={12}>
            <Typography variant={'h5'} gutterBottom>
              Backup from this device
            </Typography>

            <Typography variant={'body2'}>
              Share or save a file containing all notebooks and records stored
              on this device. Data download functionality is not well-supported
              by all device+browser combinations.
            </Typography>
          </Grid>
          <Grid item md={8} sm={6} xs={12}>
            <Grid container spacing={2} alignItems={'center'}>
              {/* <Grid item>
                <Button
                  disableElevation
                  variant={'contained'}
                  size={'small'}
                  color={'info'}
                  onClick={async () => {
                    await doDumpDownload();
                  }}
                  startIcon={<DownloadIcon />}
                >
                  Download local database contents
                </Button>
              </Grid>
              <Grid item sm={'auto'}>
                <Typography variant={'body2'}>Browsers only</Typography>
              </Grid> */}

              <Grid item>
                <Button
                  disableElevation
                  size={'small'}
                  color={'info'}
                  variant={'contained'}
                  onClick={handleShareDump}
                  startIcon={<ShareIcon />}
                >
                  Share local database contents
                </Button>
              </Grid>
            </Grid>
          </Grid>

          {(SHOW_WIPE || SHOW_MINIFAUXTON) && (
            <React.Fragment>
              <Grid item xs={12}>
                <Divider />
              </Grid>
              <Divider flexItem orientation={'horizontal'} />
              <Grid item md={4} sm={6} xs={12}>
                <Typography variant={'h5'} gutterBottom>
                  Developer Tools
                </Typography>

                <Typography variant={'body2'}>
                  Use the following with care! "Wipe and Reset" will delete all
                  data stored on this device and require you to login again.
                  "Raw Database Interface" is a tool for developers to inspect
                  inspect the raw data stored on this device.
                </Typography>
              </Grid>
              <Grid item md={8} sm={6} xs={12}>
                <Grid container spacing={2} alignItems={'center'}>
                  {SHOW_WIPE && (
                    <Grid item>
                      <Button
                        onClick={() => setWipeDialogOpen(true)}
                        color={'error'}
                        variant={'contained'}
                        disableElevation={true}
                        startIcon={<ErrorIcon />}
                      >
                        Wipe and reset everything
                      </Button>
                      <Dialog
                        open={wipeDialogOpen}
                        onClose={() => setWipeDialogOpen(false)}
                        aria-labelledby="alert-dialog-title"
                        aria-describedby="alert-dialog-description"
                      >
                        <Alert severity={'warning'}>
                          <AlertTitle>Are you sure?</AlertTitle>
                          Go ahead and wipe all local databases?
                        </Alert>
                        <DialogActions
                          style={{justifyContent: 'space-between'}}
                        >
                          <Button
                            onClick={() => setWipeDialogOpen(false)}
                            autoFocus
                            color={'warning'}
                          >
                            Cancel
                          </Button>
                          <Button
                            size={'small'}
                            variant="contained"
                            disableElevation
                            color={'error'}
                            onClick={() => {
                              unregisterServiceWorker();
                              wipe_all_pouch_databases().then(() => {
                                console.log('User cleaned database');
                                window.location.reload();
                              });
                            }}
                            startIcon={<StorageIcon />}
                          >
                            Reset local DB
                          </Button>
                        </DialogActions>
                      </Dialog>
                    </Grid>
                  )}
                  {SHOW_MINIFAUXTON && (
                    <Grid item>
                      <Button
                        variant="contained"
                        disableElevation
                        color={'warning'}
                        onClick={() => {
                          window.location.pathname = '/minifauxton.html';
                        }}
                        startIcon={<StorageIcon />}
                      >
                        Open Raw Database Interface
                      </Button>
                    </Grid>
                  )}
                </Grid>
              </Grid>
            </React.Fragment>
          )}
        </Grid>
      </Box>
      <Dialog open={showingProgress}>
        <AppBar sx={{position: 'relative'}}>
          <Toolbar>
            <Typography sx={{ml: 2, flex: 1}} variant="h6" component="div">
              {progressMessage
                ? progressMessage
                : 'Preparing to Share Database Dump...'}
            </Typography>
            <Button autoFocus color="inherit" onClick={handleCancelDump}>
              {progressMessage ? 'Dismiss' : 'Cancel'}
            </Button>
          </Toolbar>
        </AppBar>
        <LinearProgress variant="determinate" value={progress} />
      </Dialog>
    </Box>
  );
}
