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
 * Filename: index.tsx
 * Description:
 *   Creates the footer with version number and debug data on all pages.
 */

import React, {useContext} from 'react';
import {useLocation} from 'react-router-dom';
import {Box, Grid, Typography} from '@mui/material';
import packageJson from '../../../../package.json';

import {COMMIT_VERSION} from '../../../buildconfig';
import {store} from '../../../context/store';
import InProgress from '../ui/inProgress';
import BoxTab from '../ui/boxTab';
import FullFooter from './fullFooter';
import SlimFooter from './slimFooter';
// import {EHTML} from './footerEHTML';

import {grey} from '@mui/material/colors';
import * as ROUTES from '../../../constants/routes';
import {TokenContents} from 'faims3-datamodel';
interface FooterProps {
  token?: null | undefined | TokenContents;
}
export default function Footer(props: FooterProps) {
  /**
   * Display a large footer for INDEX and WORKSPACE routes
   * Show only the SlimFooter otherwise
   * Optional byline if import.meta.env.VITE_SERVICES === 'FAIMSTEXT'
   */
  // This is a MASSIVE hack because react-router is dumb and can't seem to work
  // out that shadowing a web API and doing it wrong is a bad idea...
  // What this does is cause the component to rerender when the location
  // changes, which means when we lookup window.location we get the latest
  // version and can do things with it
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  const location = useLocation().pathname;
  const showFullFooter = [
    ROUTES.INDEX,
    ROUTES.WORKSPACE,
    // ROUTES.SIGN_IN,
  ].includes(location);
  return (
    <React.Fragment>
      {showFullFooter ? (
        <FullFooter token={props.token} />
      ) : (
        <SlimFooter token={props.token} />
      )}
      {/*{import.meta.env.VITE_SERVICES === 'FAIMSTEXT' && <EHTML />}*/}
      {import.meta.env.VITE_SERVER === 'developer' && <DevelopTool />}
    </React.Fragment>
  );
}

function DevelopTool() {
  const globalState = useContext(store);
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={12}>
        <hr />
      </Grid>
      <Grid item xs={12} sm={6}>
        <code>
          {import.meta.env.VITE_TAG}: {packageJson.name} v{packageJson.version}{' '}
          ({COMMIT_VERSION})
        </code>
        {packageJson.name}
        <Box mt={2}>
          <Typography variant={'h6'}>Key</Typography>
          <InProgress />
        </Box>
      </Grid>
      <Grid item xs={12} sm={6}>
        <BoxTab
          title={'Developer tool: react GlobalState'}
          bgcolor={grey[100]}
        />
        <Box bgcolor={grey[100]} p={2} style={{overflowX: 'scroll'}}>
          <pre>
            {JSON.stringify(
              {
                ...globalState.state,
                alerts: globalState.state.alerts.map(alert => {
                  if ('element' in alert) {
                    // Alerts made with custom elements aren't JSON-stringifiable
                    return alert.toString();
                  } else {
                    return alert; //Regular alert
                  }
                }),
              },
              null,
              2
            )}
          </pre>
          Current URL: <pre>{window.location.href}</pre>
        </Box>
      </Grid>
    </Grid>
  );
}
