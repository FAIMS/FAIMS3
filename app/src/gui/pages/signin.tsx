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
 * Filename: signin.tsx
 * Description:
 *   Defines the SignIn component to present login and registration options
 */

import {Capacitor} from '@capacitor/core';
import {Box, Grid} from '@mui/material';
import * as ROUTES from '../../constants/routes';
import {selectIsAuthenticated} from '../../context/slices/authSlice';
import {selectServers} from '../../context/slices/projectSlice';
import {useAppSelector} from '../../context/store';
import {isWeb} from '../../utils/helpers';
import ClusterCard from '../components/authentication/cluster_card';
import OnboardingComponent from '../components/authentication/oneServerLanding';
import Breadcrumbs from '../components/ui/breadcrumbs';
import {QRCodeRegistration, ShortCodeRegistration} from './shortcode';

export function SignIn() {
  const breadcrumbs = [{link: ROUTES.INDEX, title: 'Home'}, {title: 'Sign In'}];
  const platform = Capacitor.getPlatform();
  const allowQr = platform === 'ios' || platform === 'android';
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const servers = useAppSelector(selectServers);

  // The conditions for this to show are to simplify onboarding in the most
  // common case i.e. one listing - check we are not already logged in and only
  // one loaded listing
  if (
    // One listing
    servers.length === 1 &&
    // It's well defined
    // We shouldn't be authenticated
    !isAuthenticated
  ) {
    return (
      <OnboardingComponent
        scanQr={allowQr}
        servers={servers}
      ></OnboardingComponent>
    );
  }

  return (
    <Box>
      <Breadcrumbs data={breadcrumbs} />
      <Grid container spacing={4}>
        {servers.map((serverInfo, index) => (
          <Grid item lg={4} md={6} sm={12} xs={12} key={index}>
            <ClusterCard
              key={serverInfo.serverId}
              serverId={serverInfo.serverId}
              listing_name={serverInfo.serverTitle}
              listing_description={serverInfo.description}
              conductor_url={serverInfo.serverUrl}
            />
          </Grid>
        ))}
        <Grid item lg={4} md={6} sm={8} xs={12} key="short-code">
          <ShortCodeRegistration servers={servers} />
        </Grid>
        {isWeb() ? (
          <></>
        ) : (
          <Grid item lg={4} md={6} sm={8} xs={12} key="qr-code">
            <QRCodeRegistration servers={servers} />
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
