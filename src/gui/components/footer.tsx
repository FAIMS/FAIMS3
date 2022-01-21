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
 * Filename: footer.tsx
 * Description:
 *   Creates the footer with version number and debug data on all pages.
 */

import React, {useContext} from 'react';
import {useLocation} from 'react-router-dom';
import {Box, Grid, Typography, Paper} from '@material-ui/core';
import grey from '@material-ui/core/colors/grey';

import packageJson from '../../../package.json';
import {COMMIT_VERSION} from '../../buildconfig';
import {store} from '../../store';
import InProgress from './ui/inProgress';
import BoxTab from './ui/boxTab';
import Link from '@material-ui/core/Link';
import {Container} from '@material-ui/core';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import {useTheme} from '@material-ui/core/styles';

import * as ROUTES from '../../constants/routes';

export default function Footer() {
  // This is a MASSIVE hack because react-router is dumb and can't seem to work
  // out that shadowing a web API and doing it wrong is a bad idea...
  // What this does is cause the component to rerender when the location
  // changes, which means when we lookup window.location we get the latest
  // version and can do things with it
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  const location = useLocation().pathname;
  const theme = useTheme();
  const not_xs = useMediaQuery(theme.breakpoints.up('sm'));
  const ispadding = [ROUTES.HOME, ROUTES.WORKSPACE, ROUTES.SIGN_IN].includes(
    location
  )
    ? true
    : false;
  return (
    <Container
      maxWidth="lg"
      style={not_xs || ispadding ? {} : {paddingLeft: 0, paddingRight: 0}}
    >
      <br />
      {process.env.REACT_APP_SERVICES === 'FAIMS' && (
        <FundingFooter not_xs={not_xs} />
      )}
      {process.env.REACT_APP_SERVER !== 'developer' && <DevelopTool />}
    </Container>
  );
}

function FundingFooter(props: {not_xs: boolean}) {
  return (
    <>
      <Paper
        style={props.not_xs ? {} : {paddingLeft: '10px', paddingRight: '10px'}}
      >
        {/* <Grid item xs={12} sm={12}>
          <hr/>
          </Grid>  */}
        <Grid container spacing={4} style={{margin: '4px 0px 2px 2px'}}>
          <Grid item xs={12} sm={12}>
            <Typography variant={'h5'}> Our Partners</Typography>
            <br />
          </Grid>
          <Grid item xs={12} sm={4}>
            <img
              src={
                process.env.REACT_APP_PARTNER_LEFT ??
                '/static/logo/partners/ARDC_logo_RGB.png'
              }
              style={{maxWidth: '90%'}}
            />
          </Grid>
          <Grid item xs={12} sm={4} style={{maxWidth: '90%'}}>
            <Typography variant={'body2'}>
              {process.env.REACT_APP_FUNDING ??
                'The FAIMS 3.0 Electronic Field Notebooks project received investment (doi: 10.47486/PL110) from the Australian Research Data Commons (ARDC). The ARDC is funded by the National Collaborative Research Infrastructure Strategy (NCRIS).'}
            </Typography>
          </Grid>
          {/* <Grid item xs={12} sm={1}>

      </Grid> */}
          <Grid item xs={12} sm={4} style={{maxWidth: '90%'}}>
            <Grid container spacing={2}>
              <Grid item xs={4} sm={4}>
                <img
                  src={
                    process.env.REACT_APP_PARTNER_1 ??
                    '/static/logo/partners/CSIRO_Solid_RGB.png'
                  }
                  style={{maxWidth: '100%'}}
                />
              </Grid>
              <Grid item xs={4} sm={4}>
                <img
                  src={
                    process.env.REACT_APP_PARTNER_2 ??
                    '/static/logo/partners/MQ_INT_VER_RGB_POS-nomargin.jpeg'
                  }
                  style={{maxWidth: '100%'}}
                />
              </Grid>
              <Grid item xs={4} sm={12}>
                <Link
                  href={
                    process.env.REACT_APP_PARTNERS_HREF ??
                    'https://faims.edu.au/partners/'
                  }
                  variant="body2"
                  target="_blank"
                  rel="noreferrer"
                >
                  {process.env.REACT_APP_PARTNERS_TEXT ?? 'All FAIMS partners'}
                </Link>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Paper>
    </>
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
          {process.env.REACT_APP_TAG}: {packageJson.name} v{packageJson.version}{' '}
          ({COMMIT_VERSION})
        </code>
        {name}
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
