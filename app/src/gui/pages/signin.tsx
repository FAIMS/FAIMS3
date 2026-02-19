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

import {Box, Grid} from '@mui/material';
import * as ROUTES from '../../constants/routes';
import {selectIsAuthenticated} from '../../context/slices/authSlice';
import {
  getSelectedServer,
  selectServers,
} from '../../context/slices/projectSlice';
import {useAppSelector} from '../../context/store';
import ClusterCard from '../components/authentication/cluster_card';
import OnboardingComponent from '../components/authentication/oneServerLanding';
import Breadcrumbs from '../components/ui/breadcrumbs';
import {QRCodeRegistration, ShortCodeRegistration} from './shortcode';
import {CAPACITOR_PLATFORM, IS_WEB_PLATFORM} from '../../buildconfig';

export function SignIn() {
  const breadcrumbs = [{link: ROUTES.INDEX, title: 'Home'}, {title: 'Sign In'}];
  const platform = CAPACITOR_PLATFORM;
  const allowQr = platform === 'ios' || platform === 'android';
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const servers = useAppSelector(selectServers);
  const selectedServer = useAppSelector(getSelectedServer);

  if (!isAuthenticated) {
    return (
      <>
        <Breadcrumbs data={breadcrumbs} />

        {selectedServer && (
          <OnboardingComponent
            scanQr={allowQr}
            servers={servers}
          ></OnboardingComponent>
        )}
      </>
    );
  } else {
    return (
      <Box>
        <Breadcrumbs data={breadcrumbs} />
        <Grid container spacing={4}>
          {selectedServer && (
            <Grid item lg={4} md={6} sm={8} xs={12} key="short-code">
              <ClusterCard
                key={selectedServer.serverId}
                serverId={selectedServer.serverId}
                listing_name={selectedServer.serverTitle}
                listing_description={selectedServer.description}
                conductor_url={selectedServer.serverUrl}
              />
            </Grid>
          )}

          <Grid item lg={4} md={6} sm={8} xs={12} key="short-code">
            <ShortCodeRegistration servers={servers} />
          </Grid>
          {IS_WEB_PLATFORM ? (
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
}
