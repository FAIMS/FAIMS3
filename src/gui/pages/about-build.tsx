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

import React, {useContext} from 'react';
import {Box, Divider, Button} from '@mui/material';
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
import {grey} from '@mui/material/colors';
import {ActionType} from '../../context/actions';
import {store} from '../../context/store';
import {startSync, setSyncError} from '../../utils/status';
export default function AboutBuild() {
  const breadcrumbs = [
    {link: ROUTES.INDEX, title: 'Home'},
    {title: 'about-build'},
  ];

  const {state, dispatch} = useContext(store);

  const handleStartSyncUp = () => {
    startSync(dispatch, ActionType.IS_SYNCING_UP);
  };
  const handleStartSyncDown = () => {
    startSync(dispatch, ActionType.IS_SYNCING_DOWN);
  };
  const handleToggleSyncError = () => {
    setSyncError(dispatch, !state.isSyncError);
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
              <tr>
                <td>Autoactivating projects</td>
                <td>{AUTOACTIVATE_PROJECTS ? 'True' : 'False'}</td>
              </tr>
            </tbody>
          </table>
        </pre>
      </Box>
      {SHOW_WIPE && (
        <Button
          variant="outlined"
          color={'primary'}
          onClick={() => {
            unregisterServiceWorker();
            wipe_all_pouch_databases().then(() => {
              console.log('User cleaned database');
              window.location.reload();
            });
          }}
          style={{marginRight: '10px'}}
        >
          Wipe and reset everything!
        </Button>
      )}
      <Button
        variant="outlined"
        color={'primary'}
        onClick={() => {
          console.log('User refreshed page');
          unregisterServiceWorker();
          window.location.reload();
        }}
        style={{marginRight: '10px'}}
      >
        Refresh the app (like in a browser)!
      </Button>
      {SHOW_MINIFAUXTON && (
        <Button
          variant="outlined"
          color={'primary'}
          onClick={() => {
            window.location.pathname = '/minifauxton.html';
          }}
          style={{marginRight: '10px'}}
        >
          Open MiniFauxton
        </Button>
      )}
      <Button
        variant="outlined"
        color={'primary'}
        onClick={async () => {
          console.error('Starting browser system dump');
          const b = await getFullDBSystemDumpAsBlob();
          console.error('Finished browser system dump, starting download');
          downloadBlob(b, 'faims3-dump.json');
        }}
        style={{marginRight: '10px'}}
      >
        Download local database contents (browsers only)
      </Button>
      <Button
        variant="outlined"
        color={'primary'}
        onClick={async () => {
          console.error('Starting app system dump');
          const s = await getFullDBSystemDump();
          console.error('Finished app system dump, starting app sharing');
          await shareStringAsFileOnApp(
            s,
            'FAIMS Database Dump',
            'Share all the FAIMS data on your device',
            'faims3-dump.json'
          );
        }}
        style={{marginRight: '10px'}}
      >
        Share local database contents (apps and some browsers)
      </Button>
      <Divider sx={{my: 3}}>Sync State Test</Divider>
      <Button variant="contained" onClick={handleStartSyncUp} sx={{mr: 1}}>
        Start Sync UP {JSON.stringify(state.isSyncingUp)}
      </Button>
      <Button variant="contained" onClick={handleStartSyncDown} sx={{mr: 1}}>
        Start Sync DOWN {JSON.stringify(state.isSyncingDown)}
      </Button>
      {/*<Button*/}
      {/*  variant="contained"*/}
      {/*  onClick={handleToggleUnsyncedChanges}*/}
      {/*  sx={{mr: 1}}*/}
      {/*>*/}
      {/*  Local changes made {JSON.stringify(state.hasUnsyncedChanges)}*/}
      {/*</Button>*/}
      <Button variant="contained" onClick={handleToggleSyncError} sx={{mr: 1}}>
        Sync Error {JSON.stringify(state.isSyncError)}
      </Button>

      <Divider sx={{my: 3}} />
    </Box>
  );
}
