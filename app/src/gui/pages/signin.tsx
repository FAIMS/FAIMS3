// SPDX-License-Identifier: Apache-2.0

/*
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
import {
  InviteCodeRegistration,
  InviteQRRegistration,
} from './inviteRegistration';
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
        {/* Should not happen but just in case we misconfigure... */}
        {!selectedServer && <Box>No Servers Configured</Box>}
      </>
    );
  } else {
    return (
      <Box>
        <Breadcrumbs data={breadcrumbs} />
        <Grid container spacing={4}>
          {selectedServer && (
            <Grid size={{lg: 4, md: 6, sm: 8, xs: 12}} key="selected-server">
              <ClusterCard
                key={selectedServer.serverId}
                serverId={selectedServer.serverId}
                listing_name={selectedServer.serverTitle}
                listing_description={selectedServer.description}
                conductor_url={selectedServer.serverUrl}
              />
            </Grid>
          )}

          {!IS_WEB_PLATFORM && (
            <Grid size={{lg: 4, md: 6, sm: 8, xs: 12}} key="invite-qr">
              <InviteQRRegistration servers={servers} />
            </Grid>
          )}
          <Grid size={{lg: 4, md: 6, sm: 8, xs: 12}} key="invite-code">
            <InviteCodeRegistration servers={servers} />
          </Grid>
        </Grid>
      </Box>
    );
  }
}
