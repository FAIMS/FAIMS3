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
  TableContainer,
  TableRow,
  TableCell,
  TableHead,
  TableBody,
  Table,
} from '@mui/material';
import {grey} from '@mui/material/colors';
import DownloadIcon from '@mui/icons-material/Download';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';
import ShareIcon from '@mui/icons-material/Share';
import * as ROUTES from '../../constants/routes';
import {unregister as unregisterServiceWorker} from '../../serviceWorkerRegistration';
import {downloadBlob, shareStringAsFileOnApp} from '../../utils/downloadShare';
import {
  getFullDBSystemDump,
  getFullDBSystemDumpAsBlob,
} from '../../sync/data-dump';
import {
  DIRECTORY_PROTOCOL,
  DIRECTORY_HOST,
  DIRECTORY_PORT,
  RUNNING_UNDER_TEST,
  COMMIT_VERSION,
  AUTOACTIVATE_PROJECTS,
  SHOW_MINIFAUXTON,
  SHOW_WIPE,
} from '../../buildconfig';
import Breadcrumbs from '../components/ui/breadcrumbs';
import {wipe_all_pouch_databases} from '../../sync/databases';
import BoxTab from '../components/ui/boxTab';

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
              <tr>
                <td>Autoactivating projects</td>
                <td>{AUTOACTIVATE_PROJECTS ? 'True' : 'False'}</td>
              </tr>
            </tbody>
          </table>
        </pre>
      </Box>
      <TableContainer component={Paper}>
        <Table sx={{minWidth: 650}} aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell>
                <Typography variant={'h5'}>Having issues?</Typography>
              </TableCell>
              <TableCell>
                <Button
                  variant="contained"
                  color={'primary'}
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
              </TableCell>
              <TableCell>
                {' '}
                <Typography variant={'body2'}>
                  This is similar to a browser refresh
                </Typography>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>
                {' '}
                <Typography variant={'h5'}>
                  Downloading data from this device
                </Typography>
              </TableCell>
              <TableCell>
                <Grid container spacing={2}>
                  <Grid item>
                    <Button
                      disableElevation
                      variant={'outlined'}
                      onClick={async () => {
                        console.error('Starting browser system dump');
                        const b = await getFullDBSystemDumpAsBlob();
                        console.error(
                          'Finished browser system dump, starting download'
                        );
                        downloadBlob(b, 'faims3-dump.json');
                      }}
                      startIcon={<DownloadIcon />}
                    >
                      Download local database contents
                    </Button>
                  </Grid>
                  <Grid item sm={'auto'}>
                    <Box mt={1}>Browsers only</Box>
                  </Grid>
                  <Grid item>
                    <Button
                      disableElevation
                      variant={'outlined'}
                      onClick={async () => {
                        console.error('Starting app system dump');
                        const s = await getFullDBSystemDump();
                        console.error(
                          'Finished app system dump, starting app sharing'
                        );
                        await shareStringAsFileOnApp(
                          s,
                          'FAIMS Database Dump',
                          'Share all the FAIMS data on your device',
                          'faims3-dump.json'
                        );
                      }}
                      startIcon={<ShareIcon />}
                    >
                      Share local database contents
                    </Button>
                  </Grid>
                  <Grid item sm={'auto'}>
                    <Box mt={1}>Apps and some browsers</Box>
                  </Grid>
                </Grid>
              </TableCell>
              <TableCell>
                <Typography variant={'body2'}>
                  Data download functionality is not well-supported by all
                  device+browser combinations. Try the following buttons to
                  access data from this device.
                </Typography>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      <Divider sx={{my: 3}} />
      {SHOW_WIPE && (
        <Button
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
          startIcon={<ErrorIcon />}
          sx={{mr: 1}}
        >
          Wipe and reset everything
        </Button>
      )}

      {SHOW_MINIFAUXTON && (
        <Button
          variant="outlined"
          disableElevation
          color={'primary'}
          onClick={() => {
            window.location.pathname = '/minifauxton.html';
          }}
        >
          Open MiniFauxton
        </Button>
      )}

      {/*<Divider sx={{my: 3}}>Sync State Test</Divider>*/}
      {/*<Button variant="contained" onClick={handleStartSyncUp} sx={{mr: 1}}>*/}
      {/*  Start Sync UP {JSON.stringify(state.isSyncingUp)}*/}
      {/*</Button>*/}
      {/*<Button variant="contained" onClick={handleStartSyncDown} sx={{mr: 1}}>*/}
      {/*  Start Sync DOWN {JSON.stringify(state.isSyncingDown)}*/}
      {/*</Button>*/}
      {/*/!*<Button*!/*/}
      {/*/!*  variant="contained"*!/*/}
      {/*/!*  onClick={handleToggleUnsyncedChanges}*!/*/}
      {/*/!*  sx={{mr: 1}}*!/*/}
      {/*/!*>*!/*/}
      {/*/!*  Local changes made {JSON.stringify(state.hasUnsyncedChanges)}*!/*/}
      {/*/!*</Button>*!/*/}
      {/*<Button variant="contained" onClick={handleToggleSyncError} sx={{mr: 1}}>*/}
      {/*  Sync Error {JSON.stringify(state.isSyncError)}*/}
      {/*</Button>*/}
      <Divider sx={{my: 3}} />
    </Box>
  );
}
