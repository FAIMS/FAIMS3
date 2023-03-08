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

import React from 'react';
import {
  Box,
  Paper,
  Divider,
  Button,
  Typography,
  Grid,
  Alert,
  AlertTitle,
} from '@mui/material';
import {grey} from '@mui/material/colors';
import DownloadIcon from '@mui/icons-material/Download';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';
import ShareIcon from '@mui/icons-material/Share';
import StorageIcon from '@mui/icons-material/Storage';
import * as ROUTES from '../../constants/routes';
import {unregister as unregisterServiceWorker} from '../../serviceWorkerRegistration';
import {doDumpShare, doDumpDownload} from '../../sync/data-dump';
import {
  DIRECTORY_PROTOCOL,
  DIRECTORY_HOST,
  DIRECTORY_PORT,
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
import Link from '@mui/material/Link';

export default function AboutBuild() {
  const breadcrumbs = [
    {link: ROUTES.INDEX, title: 'Home'},
    {title: 'about-build'},
  ];

  // const {state, dispatch} = useContext(store);

  // const handleStartSyncUp = () => {
  //   startSync(dispatch, ActionType.IS_SYNCING_UP);
  // };
  // const handleStartSyncDown = () => {
  //   startSync(dispatch, ActionType.IS_SYNCING_DOWN);
  // };
  // const handleToggleSyncError = () => {
  //   setSyncError(dispatch, !state.isSyncError);
  // };
  const [open, setOpen] = React.useState(false);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };
  return (
    <Box sx={{p: 2}}>
      <Breadcrumbs data={breadcrumbs} />
      <BoxTab title={'Developer tool: About the build'} bgcolor={grey[100]} />
      <Box bgcolor={grey[100]} p={2} style={{overflowX: 'scroll'}} mb={2}>
        <pre>
          <table>
            <tbody>
              <tr>
                <td>Directory Server</td>
                <td>
                  {DIRECTORY_PROTOCOL}://{DIRECTORY_HOST}:{DIRECTORY_PORT}/
                </td>
              </tr>
              <tr>
                <td>Commit Version</td>
                <td>{COMMIT_VERSION}</td>
              </tr>
              <tr>
                <td>Running under test</td>
                <td>{RUNNING_UNDER_TEST ? 'True' : 'False'}</td>
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
              Exporting your data?
            </Typography>

            <Typography variant={'body2'}>
              Here is a link for a laptop or desktop to visit a page listing our
              exporters. You can choose to export data from individual notebooks
              using tools on this page.
            </Typography>
          </Grid>
          <Grid item md={8} sm={6} xs={12}>
            <Typography variant={'h6'}>
              <br />
              <Link
                href="https://faims.edu.au/export/"
                target={'_blank'}
                rel="noreferrer"
              >
                Visit exporter list (external to app)
              </Link>
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <Divider />
          </Grid>
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
              Downloading data from this device
            </Typography>

            <Typography variant={'body2'}>
              Data download functionality is not well-supported by all
              device+browser combinations. Try the following buttons to access
              data from this device.
            </Typography>
          </Grid>
          <Grid item md={8} sm={6} xs={12}>
            <Grid container spacing={2} alignItems={'center'}>
              <Grid item>
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
              </Grid>
              <Grid item>
                <Button
                  disableElevation
                  size={'small'}
                  color={'info'}
                  variant={'contained'}
                  onClick={async () => {
                    await doDumpShare();
                  }}
                  startIcon={<ShareIcon />}
                >
                  Share local database contents
                </Button>
              </Grid>
              <Grid item sm={'auto'}>
                <Typography variant={'body2'}>
                  Apps and some browsers
                </Typography>
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
                  Devtools
                </Typography>

                <Typography variant={'body2'}>
                  Use the following with care!
                </Typography>
              </Grid>
              <Grid item md={8} sm={6} xs={12}>
                <Grid container spacing={2} alignItems={'center'}>
                  {SHOW_WIPE && (
                    <Grid item>
                      <Button
                        onClick={handleOpen}
                        color={'error'}
                        variant={'contained'}
                        disableElevation={true}
                        startIcon={<ErrorIcon />}
                      >
                        Wipe and reset everything
                      </Button>
                      <Dialog
                        open={open}
                        onClose={handleClose}
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
                            onClick={handleClose}
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
                        Open Mini-Fauxton
                      </Button>
                    </Grid>
                  )}
                </Grid>
              </Grid>
            </React.Fragment>
          )}
        </Grid>
      </Box>
    </Box>
  );
}
